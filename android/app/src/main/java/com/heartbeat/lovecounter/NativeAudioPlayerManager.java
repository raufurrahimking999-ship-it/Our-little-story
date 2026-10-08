package com.heartbeat.lovecounter;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Looper;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import com.getcapacitor.JSObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

public class NativeAudioPlayerManager {

    public static class SongData {
        public String id;
        public String title;
        public String artist;
        public String album;
        public String url;
        public double duration;

        public SongData(String id, String title, String artist, String album, String url, double duration) {
            this.id = id != null ? id : "";
            this.title = title != null && !title.isEmpty() ? title : "Unknown Title";
            this.artist = artist != null && !artist.equals("<unknown>") && !artist.isEmpty() ? artist : "Device Audio";
            this.album = album != null && !album.equals("<unknown>") && !album.isEmpty() ? album : "Local Music";
            this.url = url != null ? url : "";
            this.duration = duration;
        }
    }

    private static ExoPlayer player;
    private static MediaSession mediaSession;
    private static final List<SongData> playlist = new ArrayList<>();
    private static int currentSongIndex = -1;
    private static String repeatModeString = "all"; // "off", "one", "all"
    private static boolean isShuffle = false;
    private static boolean hasPlaybackError = false;

    /**
     * Extracts bundled Hawayein mp3 to app's private files directory if needed.
     * Guarantees 100% reliable local file descriptor playback, random seeking, and zero network dependency.
     */
    public static synchronized File getOrExtractBundledAudio(Context context) {
        if (context == null) return null;
        try {
            File dir = new File(context.getFilesDir(), "bundled_audio");
            if (!dir.exists()) {
                dir.mkdirs();
            }
            File targetFile = new File(dir, "hawayein.mp3");

            // If file exists and is intact (> 1MB), return it immediately
            if (targetFile.exists() && targetFile.length() > 1000000) {
                return targetFile;
            }

            // Asset paths to try
            String[] possibleAssetPaths = {
                "public/audio/hawayein.mp3",
                "public/audio/our_song.mp3",
                "audio/hawayein.mp3",
                "audio/our_song.mp3"
            };

            for (String assetPath : possibleAssetPaths) {
                try (InputStream in = context.getAssets().open(assetPath);
                     FileOutputStream out = new FileOutputStream(targetFile)) {
                    byte[] buffer = new byte[65536];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                    }
                    out.flush();
                    if (targetFile.length() > 500000) {
                        android.util.Log.i("NativeAudioPlayer", "Bundled audio extracted to: " + targetFile.getAbsolutePath());
                        return targetFile;
                    }
                } catch (Exception ignored) {
                }
            }

            return targetFile.exists() && targetFile.length() > 0 ? targetFile : null;
        } catch (Exception e) {
            android.util.Log.e("NativeAudioPlayer", "Error extracting bundled audio: " + e.getMessage(), e);
            return null;
        }
    }

    public static String resolveUrl(Context context, String url) {
        if (url == null || url.trim().isEmpty()) return "";
        String trimmed = url.trim();

        // 1. MediaStore content URI
        if (trimmed.startsWith("content://")) {
            return trimmed;
        }

        // 2. Capacitor File URI
        if (trimmed.startsWith("__capacitor_file_:///")) {
            return "file://" + trimmed.substring("__capacitor_file_:///".length() - 1);
        }

        // 3. Normal File URI
        if (trimmed.startsWith("file://")) {
            return trimmed;
        }

        // 4. Remote Web URL (excluding localhost)
        if ((trimmed.startsWith("http://") || trimmed.startsWith("https://")) 
                && !trimmed.contains("localhost")) {
            return trimmed;
        }

        // 5. Bundled track (Hawayein / our_song / local audio asset)
        if (trimmed.contains("hawayein") || trimmed.contains("our_song") || trimmed.contains("/audio/")) {
            File localFile = getOrExtractBundledAudio(context);
            if (localFile != null && localFile.exists() && localFile.length() > 0) {
                return Uri.fromFile(localFile).toString();
            }
        }

        // 6. Localhost URL from WebView
        String cleanPath = trimmed;
        if (cleanPath.startsWith("http://localhost/") || cleanPath.startsWith("https://localhost/")) {
            cleanPath = cleanPath.replaceFirst("^https?://localhost/", "");
        }
        if (cleanPath.startsWith("/")) {
            cleanPath = cleanPath.substring(1);
        }

        // 7. Asset fallback
        if (context != null) {
            try {
                InputStream is = context.getAssets().open("public/" + cleanPath);
                is.close();
                return "asset:///public/" + cleanPath;
            } catch (Exception ignored) {
                try {
                    InputStream is = context.getAssets().open(cleanPath);
                    is.close();
                    return "asset:///" + cleanPath;
                } catch (Exception ignored2) {}
            }
        }

        return "asset:///public/" + cleanPath;
    }

    public static ExoPlayer getPlayer(Context context) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            return player;
        }
        if (player == null) {
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build();

            player = new ExoPlayer.Builder(context.getApplicationContext())
                .setAudioAttributes(audioAttributes, true)
                .setHandleAudioBecomingNoisy(true)
                .setWakeMode(C.WAKE_MODE_LOCAL)
                .build();

            // Default repeat mode: ALL
            player.setRepeatMode(Player.REPEAT_MODE_ALL);

            player.addListener(new Player.Listener() {
                @Override
                public void onMediaItemTransition(MediaItem mediaItem, int reason) {
                    int idx = player.getCurrentMediaItemIndex();
                    if (idx >= 0 && idx < playlist.size()) {
                        currentSongIndex = idx;
                    }
                    hasPlaybackError = false;
                }

                @Override
                public void onPlaybackStateChanged(int state) {
                    if (state == Player.STATE_ENDED) {
                        if ("one".equalsIgnoreCase(repeatModeString)) {
                            player.seekTo(0);
                            player.play();
                        }
                    }
                    if (state == Player.STATE_READY) {
                        hasPlaybackError = false;
                    }
                }

                @Override
                public void onPlayerError(PlaybackException error) {
                    android.util.Log.e("NativeAudioPlayer", "ExoPlayer playback error: " + error.getMessage(), error);
                    hasPlaybackError = true;
                }
            });
        }
        return player;
    }

    public static MediaSession getMediaSession(Context context) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            return mediaSession;
        }
        if (mediaSession == null) {
            ExoPlayer p = getPlayer(context);
            if (p != null) {
                Intent intent = new Intent(context.getApplicationContext(), MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                PendingIntent pendingIntent = PendingIntent.getActivity(
                    context.getApplicationContext(),
                    0,
                    intent,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                );

                mediaSession = new MediaSession.Builder(context.getApplicationContext(), p)
                    .setSessionActivity(pendingIntent)
                    .build();
            }
        }
        return mediaSession;
    }

    public static synchronized void setPlaylist(Context context, List<SongData> songs, int startIndex, long startPositionMs, boolean playImmediately) {
        ExoPlayer p = getPlayer(context);
        if (p == null) return;

        boolean samePlaylist = false;
        if (songs != null && songs.size() == playlist.size() && !playlist.isEmpty()) {
            samePlaylist = true;
            for (int i = 0; i < songs.size(); i++) {
                if (!songs.get(i).url.equals(playlist.get(i).url)) {
                    samePlaylist = false;
                    break;
                }
            }
        }

        if (samePlaylist && p.getMediaItemCount() == playlist.size()) {
            int safeIndex = Math.max(0, Math.min(startIndex, playlist.size() - 1));
            currentSongIndex = safeIndex;
            p.seekTo(safeIndex, startPositionMs);
            if (playImmediately) {
                p.play();
            }
            return;
        }

        playlist.clear();
        if (songs != null) {
            playlist.addAll(songs);
        }

        if (playlist.isEmpty()) {
            p.clearMediaItems();
            currentSongIndex = -1;
            return;
        }

        int safeIndex = Math.max(0, Math.min(startIndex, playlist.size() - 1));
        currentSongIndex = safeIndex;

        List<MediaItem> mediaItems = new ArrayList<>();
        for (SongData song : playlist) {
            String resolved = resolveUrl(context, song.url);
            MediaMetadata meta = new MediaMetadata.Builder()
                .setTitle(song.title)
                .setArtist(song.artist)
                .setAlbumTitle(song.album)
                .build();

            MediaItem item = new MediaItem.Builder()
                .setUri(Uri.parse(resolved))
                .setMediaId(song.id != null && !song.id.isEmpty() ? song.id : resolved)
                .setMediaMetadata(meta)
                .build();
            mediaItems.add(item);
        }

        p.setMediaItems(mediaItems, safeIndex, startPositionMs);
        p.prepare();
        p.setPlayWhenReady(playImmediately);
        hasPlaybackError = false;
    }

    public static synchronized void playSongAtIndex(Context context, int index) {
        ExoPlayer p = getPlayer(context);
        if (p == null) return;

        if (index >= 0 && index < playlist.size()) {
            currentSongIndex = index;
            if (p.getMediaItemCount() == playlist.size()) {
                p.seekTo(index, 0);
                p.setPlayWhenReady(true);
            } else {
                setPlaylist(context, new ArrayList<>(playlist), index, 0, true);
            }
            hasPlaybackError = false;
        }
    }

    public static synchronized void playSong(Context context, String url, String title, String artist, String album, double duration) {
        ExoPlayer p = getPlayer(context);
        if (p == null) return;

        // Check if song exists in current playlist
        for (int i = 0; i < playlist.size(); i++) {
            SongData s = playlist.get(i);
            if (s.url.equals(url) || (title != null && !title.isEmpty() && s.title.equalsIgnoreCase(title))) {
                playSongAtIndex(context, i);
                return;
            }
        }

        // Single item fallback
        SongData song = new SongData("song-" + System.currentTimeMillis(), title, artist, album, url, duration);
        List<SongData> singleList = new ArrayList<>();
        singleList.add(song);
        setPlaylist(context, singleList, 0, 0, true);
    }

    public static void play(Context context) {
        ExoPlayer p = getPlayer(context);
        if (p != null) {
            if (p.getMediaItemCount() == 0) {
                // Initialize default Hawayein track
                SongData defaultSong = new SongData(
                    "bundled-hawayein",
                    "Hawayein",
                    "Arijit Singh & Pritam",
                    "Jab Harry Met Sejal",
                    "/audio/hawayein.mp3",
                    291.0
                );
                List<SongData> list = new ArrayList<>();
                list.add(defaultSong);
                setPlaylist(context, list, 0, 0, true);
                return;
            }
            if (p.getPlaybackState() == Player.STATE_ENDED) {
                p.seekTo(0);
            }
            p.setPlayWhenReady(true);
            hasPlaybackError = false;
        }
    }

    public static void pause(Context context) {
        ExoPlayer p = getPlayer(context);
        if (p != null) {
            p.setPlayWhenReady(false);
        }
    }

    public static void seekTo(Context context, long positionMs) {
        ExoPlayer p = getPlayer(context);
        if (p != null) {
            p.seekTo(Math.max(0, positionMs));
        }
    }

    public static void skipNext(Context context) {
        ExoPlayer p = getPlayer(context);
        if (p == null) return;

        if (p.hasNextMediaItem()) {
            p.seekToNextMediaItem();
        } else if (p.getMediaItemCount() > 0) {
            p.seekTo(0, 0);
        }
        p.setPlayWhenReady(true);
        hasPlaybackError = false;
    }

    public static void skipPrevious(Context context) {
        ExoPlayer p = getPlayer(context);
        if (p == null) return;

        if (p.getCurrentPosition() > 3000) {
            p.seekTo(0);
        } else if (p.hasPreviousMediaItem()) {
            p.seekToPreviousMediaItem();
        } else if (p.getMediaItemCount() > 0) {
            p.seekTo(p.getMediaItemCount() - 1, 0);
        }
        p.setPlayWhenReady(true);
        hasPlaybackError = false;
    }

    public static void setRepeatMode(Context context, String mode) {
        repeatModeString = mode != null ? mode.toLowerCase() : "all";
        ExoPlayer p = getPlayer(context);
        if (p == null) return;

        if ("one".equals(repeatModeString)) {
            p.setRepeatMode(Player.REPEAT_MODE_ONE);
        } else if ("all".equals(repeatModeString)) {
            p.setRepeatMode(Player.REPEAT_MODE_ALL);
        } else {
            p.setRepeatMode(Player.REPEAT_MODE_OFF);
        }
    }

    public static void setShuffle(Context context, boolean shuffle) {
        isShuffle = shuffle;
        ExoPlayer p = getPlayer(context);
        if (p != null) {
            p.setShuffleModeEnabled(shuffle);
        }
    }

    public static void setVolume(Context context, float volume) {
        ExoPlayer p = getPlayer(context);
        if (p != null) {
            p.setVolume(Math.max(0f, Math.min(1f, volume)));
        }
    }

    public static JSObject getStateJson(Context context) {
        JSObject ret = new JSObject();
        ExoPlayer p = getPlayer(context);

        if (p == null) {
            ret.put("isPlaying", false);
            ret.put("currentTime", 0.0);
            ret.put("duration", 0.0);
            ret.put("currentIndex", -1);
            ret.put("url", "");
            ret.put("title", "");
            ret.put("artist", "");
            ret.put("album", "");
            ret.put("isShuffle", false);
            ret.put("repeatMode", "off");
            ret.put("isEnded", false);
            ret.put("hasError", false);
            return ret;
        }

        boolean isPlaying = p.getPlayWhenReady() && p.getPlaybackState() != Player.STATE_ENDED;
        double currentSec = p.getCurrentPosition() / 1000.0;
        double durSec = p.getDuration() > 0 ? (p.getDuration() / 1000.0) : 0.0;
        int idx = p.getCurrentMediaItemIndex();

        String currentUrl = "";
        String currentTitle = "";
        String currentArtist = "";
        String currentAlbum = "";

        if (idx >= 0 && idx < playlist.size()) {
            SongData s = playlist.get(idx);
            currentUrl = s.url;
            currentTitle = s.title;
            currentArtist = s.artist;
            currentAlbum = s.album;
            if (durSec <= 0 && s.duration > 0) {
                durSec = s.duration;
            }
        } else if (p.getCurrentMediaItem() != null) {
            MediaItem item = p.getCurrentMediaItem();
            if (item.mediaMetadata != null) {
                if (item.mediaMetadata.title != null) currentTitle = item.mediaMetadata.title.toString();
                if (item.mediaMetadata.artist != null) currentArtist = item.mediaMetadata.artist.toString();
                if (item.mediaMetadata.albumTitle != null) currentAlbum = item.mediaMetadata.albumTitle.toString();
            }
            if (item.localConfiguration != null && item.localConfiguration.uri != null) {
                currentUrl = item.localConfiguration.uri.toString();
            }
        }

        ret.put("isPlaying", isPlaying);
        ret.put("currentTime", currentSec);
        ret.put("duration", durSec);
        ret.put("currentIndex", idx);
        ret.put("url", currentUrl);
        ret.put("title", currentTitle);
        ret.put("artist", currentArtist);
        ret.put("album", currentAlbum);
        ret.put("isShuffle", p.getShuffleModeEnabled());
        ret.put("repeatMode", repeatModeString);
        ret.put("isEnded", p.getPlaybackState() == Player.STATE_ENDED);
        ret.put("hasError", hasPlaybackError);

        return ret;
    }

    public static void release() {
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        playlist.clear();
        currentSongIndex = -1;
    }
}
