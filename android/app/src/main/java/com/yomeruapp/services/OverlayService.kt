package com.yomeruapp.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.yomeruapp.R

class OverlayService : Service() {

  override fun onCreate() {
    super.onCreate()
    ensureNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        Log.d(LOG_TAG, "[YomeruApp] Menghentikan OverlayService")
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        return START_NOT_STICKY
      }
      else -> {
        Log.d(LOG_TAG, "[YomeruApp] Menjalankan OverlayService untuk capture")
        startForeground(NOTIFICATION_ID, buildNotification())
      }
    }

    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun ensureNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val manager = getSystemService(NotificationManager::class.java)
    val channel = NotificationChannel(
        CHANNEL_ID,
        "YomeruApp Capture",
        NotificationManager.IMPORTANCE_LOW,
    )
    channel.description = "Foreground service untuk screen capture YomeruApp"
    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification =
      NotificationCompat.Builder(this, CHANNEL_ID)
          .setSmallIcon(R.mipmap.ic_launcher)
          .setContentTitle("YomeruApp aktif")
          .setContentText("Menyiapkan screen capture untuk OCR manga.")
          .setOngoing(true)
          .build()

  companion object {
    const val ACTION_START = "com.yomeruapp.action.START_CAPTURE_SERVICE"
    const val ACTION_STOP = "com.yomeruapp.action.STOP_CAPTURE_SERVICE"

    private const val CHANNEL_ID = "yomeruapp_capture_channel"
    private const val NOTIFICATION_ID = 1042
    private const val LOG_TAG = "YomeruApp"
  }
}
