package com.heartbeat.lovecounter;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import android.content.pm.PackageManager;
import androidx.core.app.ActivityCompat;
import androidx.core.view.WindowCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.List;

import com.getcapacitor.BridgeActivity;

import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Guarantee dark nocturnal background with zero white flash
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(0xFF040711));
        
        super.onCreate(savedInstanceState);
        registerPlugin(PermissionBridgePlugin.class);
        registerPlugin(NativeAudioPlugin.class);
        registerPlugin(VaultStoragePlugin.class);
        
        // Enable seamless transparent status bar & edge-to-edge immersive background display with zero system contrast scrim
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            android.view.Window window = getWindow();
            window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS | android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
            window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
            window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);
            
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                window.setStatusBarContrastEnforced(false);
                window.setNavigationBarContrastEnforced(false);
            }
            
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                WindowCompat.setDecorFitsSystemWindows(window, false);
            } else {
                window.getDecorView().setSystemUiVisibility(
                    android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                    android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                    android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                );
            }
        }
    }
}

@CapacitorPlugin(
    name = "PermissionBridge",
    permissions = {
        @Permission(
            strings = { Manifest.permission.READ_MEDIA_AUDIO },
            alias = "audio33"
        ),
        @Permission(
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE },
            alias = "audioLegacy"
        )
    }
)
class PermissionBridgePlugin extends Plugin {

    private String getRequiredAudioPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return Manifest.permission.READ_MEDIA_AUDIO;
        } else {
            return Manifest.permission.READ_EXTERNAL_STORAGE;
        }
    }

    @PluginMethod
    public void checkAudioPermission(PluginCall call) {
        JSObject ret = new JSObject();
        String permission = getRequiredAudioPermission();
        
        // Directly check OS permission status (failsafe)
        int result = ContextCompat.checkSelfPermission(getContext(), permission);
        
        String status = "prompt";
        if (result == PackageManager.PERMISSION_GRANTED) {
            status = "granted";
        } else {
            android.app.Activity activity = getActivity();
            if (activity != null && ActivityCompat.shouldShowRequestPermissionRationale(activity, permission)) {
                status = "prompt";
            } else {
                status = "prompt"; // Default to prompt to allow requesting natively
            }
        }
        
        ret.put("status", status);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestAudioPermission(PluginCall call) {
        String permission = getRequiredAudioPermission();
        
        // If already granted, resolve immediately
        if (ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAlias("audio33", call, "audioCallback");
        } else {
            requestPermissionForAlias("audioLegacy", call, "audioCallback");
        }
    }

    @PermissionCallback
    private void audioCallback(PluginCall call) {
        JSObject ret = new JSObject();
        String permission = getRequiredAudioPermission();
        
        // Always query the real Android OS directly to bypass any out-of-sync Capacitor states
        boolean granted = ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED;
        
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open settings", e);
        }
    }
}

@CapacitorPlugin(name = "NativeAudio")
class NativeAudioPlugin extends Plugin {

    private void ensureServiceRunning(Context context) {
        try {
            Intent serviceIntent = new Intent(context, AudioPlaybackService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception e) {
            android.util.Log.w("NativeAudio", "Could not start AudioPlaybackService: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setPlaylist(PluginCall call) {
        JSArray songsArray = call.getArray("songs");
        int startIndex = call.getInt("startIndex", 0);
        long startPositionMs = (long) (call.getDouble("startPositionSeconds", 0.0) * 1000);
        boolean playImmediately = Boolean.TRUE.equals(call.getBoolean("playImmediately", false));

        getBridge().getActivity().runOnUiThread(() -> {
            try {
                Context context = getContext();
                ensureServiceRunning(context);

                List<NativeAudioPlayerManager.SongData> list = new ArrayList<>();
                if (songsArray != null) {
                    for (int i = 0; i < songsArray.length(); i++) {
                        org.json.JSONObject obj = songsArray.getJSONObject(i);
                        String id = obj.optString("id", "song-" + i);
                        String title = obj.optString("title", "Unknown Title");
                        String artist = obj.optString("artist", "Device Audio");
                        String album = obj.optString("album", "Local Music");
                        String url = obj.optString("url", "");
                        double duration = obj.optDouble("duration", 180.0);
                        list.add(new NativeAudioPlayerManager.SongData(id, title, artist, album, url, duration));
                    }
                }

                NativeAudioPlayerManager.setPlaylist(context, list, startIndex, startPositionMs, playImmediately);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Error setting playlist", e);
            }
        });
    }

    @PluginMethod
    public void playSong(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title", "Our Special Song");
        String artist = call.getString("artist", "Our Little Story");
        String album = call.getString("album", "Local Music");
        Double duration = call.getDouble("duration", 180.0);
        Integer index = call.getInt("index", -1);
        JSArray songsArray = call.getArray("songs");

        getBridge().getActivity().runOnUiThread(() -> {
            try {
                Context context = getContext();
                ensureServiceRunning(context);

                if (songsArray != null && songsArray.length() > 0) {
                    List<NativeAudioPlayerManager.SongData> list = new ArrayList<>();
                    for (int i = 0; i < songsArray.length(); i++) {
                        org.json.JSONObject obj = songsArray.getJSONObject(i);
                        String sId = obj.optString("id", "song-" + i);
                        String sTitle = obj.optString("title", "Unknown Title");
                        String sArtist = obj.optString("artist", "Device Audio");
                        String sAlbum = obj.optString("album", "Local Music");
                        String sUrl = obj.optString("url", "");
                        double sDur = obj.optDouble("duration", 180.0);
                        list.add(new NativeAudioPlayerManager.SongData(sId, sTitle, sArtist, sAlbum, sUrl, sDur));
                    }
                    int playIdx = index != null && index >= 0 ? index : 0;
                    NativeAudioPlayerManager.setPlaylist(context, list, playIdx, 0, true);
                } else if (index != null && index >= 0) {
                    NativeAudioPlayerManager.playSongAtIndex(context, index);
                } else if (url != null && !url.isEmpty()) {
                    NativeAudioPlayerManager.playSong(context, url, title, artist, album, duration != null ? duration : 180.0);
                } else {
                    NativeAudioPlayerManager.play(context);
                }

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Error in native playback", e);
            }
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        getBridge().getActivity().runOnUiThread(() -> {
            NativeAudioPlayerManager.pause(getContext());
            call.resolve();
        });
    }

    @PluginMethod
    public void resume(PluginCall call) {
        getBridge().getActivity().runOnUiThread(() -> {
            Context context = getContext();
            ensureServiceRunning(context);
            NativeAudioPlayerManager.play(context);
            call.resolve();
        });
    }

    @PluginMethod
    public void seek(PluginCall call) {
        Double seconds = call.getDouble("seconds");
        if (seconds == null) {
            call.reject("seconds is required");
            return;
        }

        getBridge().getActivity().runOnUiThread(() -> {
            NativeAudioPlayerManager.seekTo(getContext(), (long) (seconds * 1000));
            call.resolve();
        });
    }

    @PluginMethod
    public void skipNext(PluginCall call) {
        getBridge().getActivity().runOnUiThread(() -> {
            Context context = getContext();
            ensureServiceRunning(context);
            NativeAudioPlayerManager.skipNext(context);
            call.resolve(NativeAudioPlayerManager.getStateJson(context));
        });
    }

    @PluginMethod
    public void skipPrevious(PluginCall call) {
        getBridge().getActivity().runOnUiThread(() -> {
            Context context = getContext();
            ensureServiceRunning(context);
            NativeAudioPlayerManager.skipPrevious(context);
            call.resolve(NativeAudioPlayerManager.getStateJson(context));
        });
    }

    @PluginMethod
    public void setRepeatMode(PluginCall call) {
        String mode = call.getString("mode", "all");
        getBridge().getActivity().runOnUiThread(() -> {
            NativeAudioPlayerManager.setRepeatMode(getContext(), mode);
            call.resolve();
        });
    }

    @PluginMethod
    public void setShuffle(PluginCall call) {
        Boolean shuffle = call.getBoolean("shuffle", false);
        getBridge().getActivity().runOnUiThread(() -> {
            NativeAudioPlayerManager.setShuffle(getContext(), Boolean.TRUE.equals(shuffle));
            call.resolve();
        });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Double volume = call.getDouble("volume");
        if (volume == null) {
            call.reject("volume is required");
            return;
        }

        getBridge().getActivity().runOnUiThread(() -> {
            NativeAudioPlayerManager.setVolume(getContext(), volume.floatValue());
            call.resolve();
        });
    }

    @PluginMethod
    public void getState(PluginCall call) {
        getBridge().getActivity().runOnUiThread(() -> {
            JSObject ret = NativeAudioPlayerManager.getStateJson(getContext());
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void stopPlayback(PluginCall call) {
        getBridge().getActivity().runOnUiThread(() -> {
            NativeAudioPlayerManager.pause(getContext());
            call.resolve();
        });
    }

    @PluginMethod
    public void scanDeviceAudio(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();
        com.getcapacitor.JSArray songList = new com.getcapacitor.JSArray();

        String permission = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU 
            ? Manifest.permission.READ_MEDIA_AUDIO 
            : Manifest.permission.READ_EXTERNAL_STORAGE;
            
        if (ContextCompat.checkSelfPermission(context, permission) != PackageManager.PERMISSION_GRANTED) {
            android.util.Log.w("NativeAudio", "Cannot scan device audio: permission not granted.");
            ret.put("songs", songList);
            call.resolve(ret);
            return;
        }

        android.content.ContentResolver resolver = context.getContentResolver();
        android.net.Uri uri = android.provider.MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        
        String[] projection = {
            android.provider.MediaStore.Audio.Media._ID,
            android.provider.MediaStore.Audio.Media.TITLE,
            android.provider.MediaStore.Audio.Media.ARTIST,
            android.provider.MediaStore.Audio.Media.ALBUM,
            android.provider.MediaStore.Audio.Media.DURATION,
            android.provider.MediaStore.Audio.Media.DISPLAY_NAME
        };

        // Filter out audio clips under 3 seconds (notifications, clicks), but keep all songs
        String selection = android.provider.MediaStore.Audio.Media.DURATION + " >= 3000";
        String sortOrder = android.provider.MediaStore.Audio.Media.TITLE + " COLLATE NOCASE ASC";
        android.database.Cursor cursor = null;

        try {
            cursor = resolver.query(uri, projection, selection, null, sortOrder);
            if (cursor != null && cursor.moveToFirst()) {
                int idCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media._ID);
                int titleCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.TITLE);
                int artistCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.ARTIST);
                int albumCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.ALBUM);
                int durationCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.DURATION);
                int nameCol = cursor.getColumnIndex(android.provider.MediaStore.Audio.Media.DISPLAY_NAME);

                do {
                    long id = cursor.getLong(idCol);
                    String title = cursor.getString(titleCol);
                    String artist = cursor.getString(artistCol);
                    String album = cursor.getString(albumCol);
                    long durationMs = cursor.getLong(durationCol);
                    String displayName = nameCol != -1 ? cursor.getString(nameCol) : "";

                    if ((title == null || title.trim().isEmpty() || title.equals("<unknown>")) && displayName != null && !displayName.isEmpty()) {
                        title = displayName.replaceFirst("[.][^.]+$", "");
                    }
                    if (title == null || title.trim().isEmpty()) {
                        title = "Unknown Track";
                    }

                    if (artist == null || artist.trim().isEmpty() || artist.equals("<unknown>")) {
                        artist = "Device Audio";
                    }

                    if (album == null || album.trim().isEmpty() || album.equals("<unknown>")) {
                        album = "Local Music";
                    }

                    android.net.Uri contentUri = android.content.ContentUris.withAppendedId(
                        android.provider.MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, 
                        id
                    );

                    JSObject songObj = new JSObject();
                    songObj.put("id", "native-" + id);
                    songObj.put("title", title);
                    songObj.put("artist", artist);
                    songObj.put("album", album);
                    songObj.put("duration", durationMs > 0 ? (durationMs / 1000.0) : 180.0);
                    songObj.put("url", contentUri.toString());

                    songList.put(songObj);
                } while (cursor.moveToNext());
            }
        } catch (Exception e) {
            android.util.Log.e("NativeAudio", "Error querying MediaStore: " + e.getMessage(), e);
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }

        ret.put("songs", songList);
        call.resolve(ret);
    }
}
