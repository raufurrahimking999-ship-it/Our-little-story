package com.heartbeat.lovecounter;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "NativeAudio")
public class NativeAudioPlugin extends Plugin {

    private void ensureServiceRunning(Context context) {
        try {
            Intent serviceIntent = new Intent(context, AudioPlaybackService.class);
            context.startService(serviceIntent);
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
        String url = call.getString("url", "/audio/hawayein.mp3");
        String title = call.getString("title", "Hawayein");
        String artist = call.getString("artist", "Arijit Singh & Pritam");
        String album = call.getString("album", "Jab Harry Met Sejal");
        Double duration = call.getDouble("duration", 291.0);
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

                    int playIdx = -1;
                    if (url != null && !url.trim().isEmpty()) {
                        String matchUrl = url.trim();
                        for (int i = 0; i < list.size(); i++) {
                            String itemUrl = list.get(i).url;
                            if (matchUrl.equals(itemUrl) || matchUrl.endsWith(itemUrl) || itemUrl.endsWith(matchUrl)) {
                                playIdx = i;
                                break;
                            }
                        }
                    }
                    if (playIdx == -1) {
                        playIdx = (index != null && index >= 0 && index < list.size()) ? index : 0;
                    }
                    NativeAudioPlayerManager.setPlaylist(context, list, playIdx, 0, true);
                } else if (url != null && !url.trim().isEmpty()) {
                    NativeAudioPlayerManager.playSong(context, url.trim(), title, artist, album, duration != null ? duration : 180.0);
                } else if (index != null && index >= 0 && index < NativeAudioPlayerManager.getPlaylistSize()) {
                    NativeAudioPlayerManager.playSongAtIndex(context, index);
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
        Double volume = call.getDouble("volume", 1.0);
        getBridge().getActivity().runOnUiThread(() -> {
            NativeAudioPlayerManager.setVolume(getContext(), (float) (volume != null ? volume : 1.0));
            call.resolve();
        });
    }

    @PluginMethod
    public void getState(PluginCall call) {
        getBridge().getActivity().runOnUiThread(() -> {
            call.resolve(NativeAudioPlayerManager.getStateJson(getContext()));
        });
    }

    @PluginMethod
    public void stopPlayback(PluginCall call) {
        getBridge().getActivity().runOnUiThread(() -> {
            NativeAudioPlayerManager.stop(getContext());
            call.resolve();
        });
    }

    @PluginMethod
    public void scanDeviceAudio(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();
        JSArray songList = new JSArray();

        if (!PermissionBridgePlugin.hasAudioPermission(context)) {
            android.util.Log.w("NativeAudio", "Cannot scan device audio: permission not granted.");
            ret.put("songs", songList);
            call.resolve(ret);
            return;
        }

        ContentResolver resolver = context.getContentResolver();
        Uri uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        
        String[] projection = {
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.DISPLAY_NAME
        };

        // Filter out ringtones, alarms, and notifications, but keep all genuine music tracks
        // Include tracks marked IS_MUSIC OR tracks longer than 15 seconds
        String selection = "(" + MediaStore.Audio.Media.IS_MUSIC + " != 0 OR "
            + MediaStore.Audio.Media.DURATION + " >= 15000) AND ("
            + MediaStore.Audio.Media.IS_NOTIFICATION + " = 0 OR "
            + MediaStore.Audio.Media.IS_NOTIFICATION + " IS NULL) AND ("
            + MediaStore.Audio.Media.IS_ALARM + " = 0 OR "
            + MediaStore.Audio.Media.IS_ALARM + " IS NULL) AND ("
            + MediaStore.Audio.Media.IS_RINGTONE + " = 0 OR "
            + MediaStore.Audio.Media.IS_RINGTONE + " IS NULL)";

        String sortOrder = MediaStore.Audio.Media.TITLE + " COLLATE NOCASE ASC";
        Cursor cursor = null;

        try {
            cursor = resolver.query(uri, projection, selection, null, sortOrder);
            if (cursor == null || !cursor.moveToFirst()) {
                if (cursor != null) cursor.close();
                String fallbackSelection = MediaStore.Audio.Media.DURATION + " >= 10000";
                cursor = resolver.query(uri, projection, fallbackSelection, null, sortOrder);
            }

            if (cursor != null && cursor.moveToFirst()) {
                int idCol = cursor.getColumnIndex(MediaStore.Audio.Media._ID);
                int titleCol = cursor.getColumnIndex(MediaStore.Audio.Media.TITLE);
                int artistCol = cursor.getColumnIndex(MediaStore.Audio.Media.ARTIST);
                int albumCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM);
                int durationCol = cursor.getColumnIndex(MediaStore.Audio.Media.DURATION);
                int nameCol = cursor.getColumnIndex(MediaStore.Audio.Media.DISPLAY_NAME);

                if (idCol != -1) {
                    do {
                        long id = cursor.getLong(idCol);
                        String title = titleCol != -1 ? cursor.getString(titleCol) : null;
                        String artist = artistCol != -1 ? cursor.getString(artistCol) : null;
                        String album = albumCol != -1 ? cursor.getString(albumCol) : null;
                        long durationMs = durationCol != -1 ? cursor.getLong(durationCol) : 0;
                        String displayName = nameCol != -1 ? cursor.getString(nameCol) : "";

                        // Exclude short clips under 3 seconds
                        if (durationMs > 0 && durationMs < 3000) {
                            continue;
                        }

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

                        Uri contentUri = ContentUris.withAppendedId(
                            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, 
                            id
                        );

                        JSObject songObj = new JSObject();
                        songObj.put("id", "native-" + id);
                        songObj.put("title", title);
                        songObj.put("artist", artist);
                        songObj.put("album", album);
                        songObj.put("duration", durationMs > 0 ? (durationMs / 1000.0) : 0.0);
                        songObj.put("url", contentUri.toString());

                        songList.put(songObj);
                    } while (cursor.moveToNext());
                }
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
