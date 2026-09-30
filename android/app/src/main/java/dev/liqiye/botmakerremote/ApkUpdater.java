package dev.liqiye.botmakerremote;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Downloads a release APK, checks it, and hands it to Android's installer — in the app, instead of through
 * the browser's Downloads (2026-09-30). A copy of botmaker-pilot's, as the rest of the update code is.
 *
 * <p>Everything Android's installer would refuse with a bare "App not installed" is checked here first and
 * refused with a reason the web UI can show, each as a {@code code} on the rejected call:
 * <ul>
 *   <li>{@code CHECKSUM} — the file is not the one the release published ({@code <apk>.sha256});
 *   <li>{@code PACKAGE} — the file is some other app;
 *   <li>{@code NOT_NEWER} — its versionCode does not exceed the installed one;
 *   <li>{@code SIGNATURE} — it is signed by a different key. The one time this is expected is the move off
 *       CI's throwaway debug keys: the phone must uninstall once, and nothing an app can do avoids that;
 *   <li>{@code PERMISSION} — this app may not install packages yet; Android's settings page is opened;
 *   <li>{@code UNSUPPORTED} — Android below 7, where the installer cannot read a content:// URI;
 *   <li>{@code DOWNLOAD} — the network failed.
 * </ul>
 *
 * <p>Progress is reported as {@code progress} events ({@code received}, {@code total}, bytes; total is -1
 * when the server does not say).
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdater extends Plugin {

    private static final int BUFFER = 64 * 1024;

    @PluginMethod
    public void install(PluginCall call) {
        String apkUrl = call.getString("url");
        String shaUrl = call.getString("sha256Url");
        if (apkUrl == null || shaUrl == null) {
            call.reject("url and sha256Url are required", "DOWNLOAD");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            call.reject("This Android version cannot install from inside the app.", "UNSUPPORTED");
            return;
        }
        new Thread(() -> run(call, apkUrl, shaUrl), "apk-updater").start();
    }

    private void run(PluginCall call, String apkUrl, String shaUrl) {
        File apk = new File(new File(getContext().getCacheDir(), "update"), "update.apk");
        try {
            String expected = readText(shaUrl).trim().split("\\s+")[0].toLowerCase(Locale.ROOT);
            String actual = download(apkUrl, apk);
            if (!actual.equals(expected)) {
                apk.delete();
                call.reject("The download is damaged (checksum mismatch). Try again.", "CHECKSUM");
                return;
            }
        } catch (IOException e) {
            apk.delete();
            call.reject("Download failed: " + e.getMessage(), "DOWNLOAD");
            return;
        }

        if (!installable(apk, call)) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settings);
            call.reject("Allow installing apps from this app, then tap Update again.", "PERMISSION");
            return;
        }

        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(uri, "application/vnd.android.package-archive");
        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(install);
        call.resolve();
    }

    /** Whether Android's installer would take {@code apk} over this app; rejects {@code call} when not. */
    @SuppressWarnings("deprecation")
    private boolean installable(File apk, PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo incoming = pm.getPackageArchiveInfo(apk.getPath(), flags);
        if (incoming == null) {
            call.reject("The download is not an app package.", "CHECKSUM");
            return false;
        }
        String self = getContext().getPackageName();
        if (!self.equals(incoming.packageName)) {
            call.reject("The download is a different app (" + incoming.packageName + ").", "PACKAGE");
            return false;
        }
        PackageInfo installed;
        try {
            installed = pm.getPackageInfo(self, flags);
        } catch (PackageManager.NameNotFoundException e) {
            return true;
        }
        if (versionCode(incoming) <= versionCode(installed)) {
            call.reject("This version is already installed.", "NOT_NEWER");
            return false;
        }
        Set<String> theirs = signers(incoming);
        if (!theirs.isEmpty() && !theirs.equals(signers(installed))) {
            call.reject("This update is signed with the new release key, and the installed app with an old one. "
                    + "Android cannot update across keys: uninstall the app once, then install it again.",
                    "SIGNATURE");
            return false;
        }
        return true;
    }

    @SuppressWarnings("deprecation")
    private static long versionCode(PackageInfo info) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }

    @SuppressWarnings("deprecation")
    private static Set<String> signers(PackageInfo info) {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            signatures = info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners();
        } else {
            signatures = info.signatures;
        }
        Set<String> out = new HashSet<>();
        if (signatures != null) {
            for (Signature s : signatures) out.add(hex(sha256().digest(s.toByteArray())));
        }
        return out;
    }

    /** Downloads {@code url} to {@code target}, reporting progress, and answers the file's SHA-256. */
    private String download(String url, File target) throws IOException {
        File dir = target.getParentFile();
        if (dir != null && !dir.isDirectory() && !dir.mkdirs()) throw new IOException("cannot create " + dir);
        HttpURLConnection connection = open(url);
        long total = connection.getContentLengthLong();
        MessageDigest digest = sha256();
        long received = 0;
        long reported = 0;
        try (InputStream in = connection.getInputStream(); OutputStream out = new FileOutputStream(target)) {
            byte[] buffer = new byte[BUFFER];
            for (int n; (n = in.read(buffer)) > 0; ) {
                out.write(buffer, 0, n);
                digest.update(buffer, 0, n);
                received += n;
                if (received - reported >= 256 * 1024) {
                    reported = received;
                    progress(received, total);
                }
            }
        } finally {
            connection.disconnect();
        }
        progress(received, total);
        return hex(digest.digest());
    }

    private void progress(long received, long total) {
        JSObject event = new JSObject();
        event.put("received", received);
        event.put("total", total);
        notifyListeners("progress", event);
    }

    private static String readText(String url) throws IOException {
        HttpURLConnection connection = open(url);
        try (InputStream in = connection.getInputStream()) {
            byte[] bytes = new byte[4096];
            int length = 0;
            for (int n; length < bytes.length && (n = in.read(bytes, length, bytes.length - length)) > 0; ) {
                length += n;
            }
            return new String(bytes, 0, length, StandardCharsets.US_ASCII);
        } finally {
            connection.disconnect();
        }
    }

    /** GitHub's download links redirect to its storage host; HttpURLConnection follows https→https itself. */
    private static HttpURLConnection open(String url) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(30_000);
        int status = connection.getResponseCode();
        if (status != HttpURLConnection.HTTP_OK) {
            connection.disconnect();
            throw new IOException("HTTP " + status + " for " + url);
        }
        return connection;
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format(Locale.ROOT, "%02x", b));
        return sb.toString();
    }
}
