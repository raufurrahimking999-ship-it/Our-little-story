package com.heartbeat.lovecounter;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * VaultStoragePlugin
 * 
 * Provides genuinely private encrypted storage for Memory Vault.
 * - Stores files exclusively inside the app-private internal directory:
 *   /data/user/0/com.heartbeat.lovecounter/files/vault_encrypted/
 * - Excluded from Android MediaStore / Gallery indexing via sandboxed Linux UID + .nomedia.
 * - Files on disk are 100% AES-GCM encrypted byte streams (.enc).
 * - Temporary import files are cleaned up immediately upon completion.
 */
@CapacitorPlugin(name = "VaultStorage")
public class VaultStoragePlugin extends Plugin {

    private File getEncryptedDirectory() {
        Context context = getContext();
        File dir = new File(context.getFilesDir(), "vault_encrypted");
        if (!dir.exists()) {
            dir.mkdirs();
        }

        // Add .nomedia file
        File noMedia = new File(dir, ".nomedia");
        if (!noMedia.exists()) {
            try {
                noMedia.createNewFile();
            } catch (IOException ignored) {}
        }
        return dir;
    }

    private File getTempDirectory() {
        Context context = getContext();
        File dir = new File(context.getCacheDir(), "vault_import_temp");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    @PluginMethod
    public void writeEncryptedFile(PluginCall call) {
        String fileId = call.getString("fileId");
        String base64Data = call.getString("base64Data");

        if (fileId == null || base64Data == null) {
            call.reject("fileId and base64Data are required");
            return;
        }

        try {
            File vaultDir = getEncryptedDirectory();
            String safeFileName = fileId.replaceAll("[^a-zA-Z0-9_-]", "") + ".enc";
            File targetFile = new File(vaultDir, safeFileName);

            byte[] bytes = Base64.decode(base64Data, Base64.NO_WRAP);
            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                fos.write(bytes);
                fos.flush();
            }

            // Verify write
            if (!targetFile.exists() || targetFile.length() == 0) {
                if (targetFile.exists()) targetFile.delete();
                call.reject("Verification failed: Encrypted target file is empty.");
                return;
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("verified", true);
            ret.put("filePath", targetFile.getAbsolutePath());
            ret.put("size", targetFile.length());
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Failed to write encrypted file: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void readEncryptedFile(PluginCall call) {
        String filePath = call.getString("filePath");
        String fileId = call.getString("fileId");

        try {
            File target;
            if (filePath != null && !filePath.isEmpty()) {
                target = new File(filePath);
            } else if (fileId != null && !fileId.isEmpty()) {
                String safeFileName = fileId.replaceAll("[^a-zA-Z0-9_-]", "") + ".enc";
                target = new File(getEncryptedDirectory(), safeFileName);
            } else {
                call.reject("filePath or fileId is required");
                return;
            }

            if (!target.exists() || target.length() == 0) {
                call.reject("File not found or empty: " + target.getAbsolutePath());
                return;
            }

            long length = target.length();
            if (length > 150 * 1024 * 1024) { // 150 MB safety cap
                call.reject("File exceeds maximum readable size.");
                return;
            }

            byte[] bytes = new byte[(int) length];
            try (FileInputStream fis = new FileInputStream(target)) {
                int offset = 0;
                int read;
                while (offset < bytes.length && (read = fis.read(bytes, offset, bytes.length - offset)) >= 0) {
                    offset += read;
                }
            }

            String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("base64Data", base64);
            ret.put("size", target.length());
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Failed to read encrypted file: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void deleteEncryptedFile(PluginCall call) {
        String filePath = call.getString("filePath");
        String fileId = call.getString("fileId");

        try {
            File target;
            if (filePath != null && !filePath.isEmpty()) {
                target = new File(filePath);
            } else if (fileId != null && !fileId.isEmpty()) {
                String safeFileName = fileId.replaceAll("[^a-zA-Z0-9_-]", "") + ".enc";
                target = new File(getEncryptedDirectory(), safeFileName);
            } else {
                call.reject("filePath or fileId is required");
                return;
            }

            boolean deleted = false;
            if (target.exists()) {
                deleted = target.delete();
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("deleted", deleted);
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Error deleting file: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void deleteEncryptedFilesBatch(PluginCall call) {
        JSArray paths = call.getArray("filePaths");
        if (paths == null) {
            call.resolve(new JSObject().put("success", true));
            return;
        }

        try {
            File vaultDir = getEncryptedDirectory();
            String vaultCanonical = vaultDir.getCanonicalPath();

            for (int i = 0; i < paths.length(); i++) {
                String path = paths.getString(i);
                if (path != null && !path.isEmpty()) {
                    File file = new File(path);
                    if (file.getCanonicalPath().startsWith(vaultCanonical) && file.exists()) {
                        file.delete();
                    }
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error deleting batch files: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void checkVaultFile(PluginCall call) {
        String filePath = call.getString("filePath");
        String fileId = call.getString("fileId");

        try {
            File file;
            if (filePath != null && !filePath.isEmpty()) {
                file = new File(filePath);
            } else if (fileId != null && !fileId.isEmpty()) {
                String safeFileName = fileId.replaceAll("[^a-zA-Z0-9_-]", "") + ".enc";
                file = new File(getEncryptedDirectory(), safeFileName);
            } else {
                JSObject ret = new JSObject();
                ret.put("exists", false);
                call.resolve(ret);
                return;
            }

            File vaultDir = getEncryptedDirectory();
            boolean valid = file.getCanonicalPath().startsWith(vaultDir.getCanonicalPath()) && file.exists() && file.length() > 0;

            JSObject ret = new JSObject();
            ret.put("exists", valid);
            ret.put("size", valid ? file.length() : 0);
            ret.put("filePath", valid ? file.getAbsolutePath() : null);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("exists", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void cleanupTemp(PluginCall call) {
        try {
            File tempDir = getTempDirectory();
            File[] files = tempDir.listFiles();
            if (files != null) {
                for (File f : files) {
                    f.delete();
                }
            }
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.resolve(new JSObject().put("success", false));
        }
    }

    @PluginMethod
    public void pickMediaFiles(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/*", "video/*"});
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addCategory(Intent.CATEGORY_OPENABLE);

        startActivityForResult(call, intent, "pickerCallback");
    }

    @ActivityCallback
    private void pickerCallback(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject emptyRet = new JSObject();
            emptyRet.put("items", new JSArray());
            call.resolve(emptyRet);
            return;
        }

        Intent data = result.getData();
        List<Uri> uris = new ArrayList<>();

        if (data.getClipData() != null) {
            int count = data.getClipData().getItemCount();
            for (int i = 0; i < count; i++) {
                uris.add(data.getClipData().getItemAt(i).getUri());
            }
        } else if (data.getData() != null) {
            uris.add(data.getData());
        }

        if (uris.isEmpty()) {
            JSObject emptyRet = new JSObject();
            emptyRet.put("items", new JSArray());
            call.resolve(emptyRet);
            return;
        }

        JSArray itemsArray = new JSArray();
        ContentResolver resolver = getContext().getContentResolver();

        for (Uri uri : uris) {
            try {
                String displayName = "media_" + System.currentTimeMillis();
                long originalSize = -1;
                String mimeType = resolver.getType(uri);

                try (Cursor cursor = resolver.query(uri, null, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (nameIndex != -1) {
                            displayName = cursor.getString(nameIndex);
                        }
                        int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                        if (sizeIndex != -1) {
                            originalSize = cursor.getLong(sizeIndex);
                        }
                    }
                }

                // Read bytes into Base64 for WebCrypto encryption pipeline
                byte[] bytes;
                try (InputStream in = resolver.openInputStream(uri)) {
                    if (in == null) continue;
                    java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
                    byte[] temp = new byte[65536];
                    int read;
                    while ((read = in.read(temp)) != -1) {
                        buffer.write(temp, 0, read);
                    }
                    bytes = buffer.toByteArray();
                }

                if (bytes == null || bytes.length == 0) continue;

                String type = (mimeType != null && mimeType.startsWith("video")) ? "video" : "image";

                JSObject item = new JSObject();
                item.put("name", displayName);
                item.put("type", type);
                item.put("mimeType", mimeType != null ? mimeType : (type.equals("video") ? "video/mp4" : "image/jpeg"));
                item.put("size", bytes.length);
                item.put("base64Data", Base64.encodeToString(bytes, Base64.NO_WRAP));

                itemsArray.put(item);
            } catch (Exception ex) {
                android.util.Log.w("VaultStorage", "Error reading selected media item: " + ex.getMessage());
            }
        }

        JSObject ret = new JSObject();
        ret.put("items", itemsArray);
        call.resolve(ret);
    }
}
