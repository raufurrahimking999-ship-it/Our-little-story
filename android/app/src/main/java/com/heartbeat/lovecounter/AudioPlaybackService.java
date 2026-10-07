package com.heartbeat.lovecounter;

import android.content.Intent;
import androidx.annotation.Nullable;
import androidx.media3.common.Player;
import androidx.media3.session.DefaultMediaNotificationProvider;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

public class AudioPlaybackService extends MediaSessionService {

    @Override
    public void onCreate() {
        super.onCreate();

        try {
            // Configure Media3 Notification with the app's clean professional heart icon
            DefaultMediaNotificationProvider provider = 
                new DefaultMediaNotificationProvider.Builder(getApplicationContext()).build();
            provider.setSmallIcon(R.drawable.ic_stat_heart);
            setMediaNotificationProvider(provider);
        } catch (Exception e) {
            android.util.Log.w("AudioPlaybackService", "Could not configure custom notification provider: " + e.getMessage());
        }

        // Initialize the MediaSession
        NativeAudioPlayerManager.getMediaSession(this);
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return NativeAudioPlayerManager.getMediaSession(this);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        // If music is actively playing when user swipes away app from Recents, keep the foreground service running!
        Player player = NativeAudioPlayerManager.getPlayer(this);
        if (player != null && player.getPlayWhenReady() && player.getPlaybackState() != Player.STATE_ENDED) {
            return;
        }
        NativeAudioPlayerManager.release();
        stopSelf();
    }
}
