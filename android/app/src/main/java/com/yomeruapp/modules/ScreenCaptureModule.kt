package com.yomeruapp.modules

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.yomeruapp.services.OverlayService
import java.io.File
import java.io.FileOutputStream

class ScreenCaptureModule(private val appContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(appContext) {

  private val mainHandler = Handler(Looper.getMainLooper())
  private val mediaProjectionManager =
      appContext.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager

  private var permissionPromise: Promise? = null
  private var capturePromise: Promise? = null
  private var projectionData: Intent? = null
  private var projectionResultCode: Int? = null
  private var mediaProjection: MediaProjection? = null
  private var imageReader: ImageReader? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var captureTimeoutRunnable: Runnable? = null
  private var captureCompleted = false

  private val activityEventListener =
      object : BaseActivityEventListener() {
        override fun onActivityResult(
            activity: android.app.Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?,
        ) {
          if (requestCode != REQUEST_CAPTURE_PERMISSION) {
            return
          }

          val promise = permissionPromise ?: return
          permissionPromise = null

          if (resultCode != android.app.Activity.RESULT_OK || data == null) {
            Log.w(LOG_TAG, "[YomeruApp] Permission capture ditolak user")
            promise.reject("CAPTURE_PERMISSION_DENIED", "Izin screen capture ditolak")
            return
          }

          projectionResultCode = resultCode
          projectionData = Intent(data)
          Log.d(LOG_TAG, "[YomeruApp] Permission capture berhasil disimpan")
          promise.resolve("granted")
        }

        override fun onNewIntent(intent: Intent) = Unit
      }

  init {
    appContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "ScreenCaptureModule"

  @ReactMethod
  fun requestCapturePermission(promise: Promise) {
    if (permissionPromise != null) {
      promise.reject("CAPTURE_PERMISSION_PENDING", "Dialog screen capture masih aktif")
      return
    }

    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Activity aktif tidak tersedia untuk meminta permission")
      return
    }

    permissionPromise = promise
    Log.d(LOG_TAG, "[YomeruApp] Meminta permission screen capture")
    activity.startActivityForResult(
        mediaProjectionManager.createScreenCaptureIntent(),
        REQUEST_CAPTURE_PERMISSION,
    )
  }

  @ReactMethod
  fun captureScreen(promise: Promise) {
    if (capturePromise != null) {
      promise.reject("CAPTURE_IN_PROGRESS", "Screen capture sebelumnya belum selesai")
      return
    }

    val resultCode = projectionResultCode
    val data = projectionData

    if (resultCode == null || data == null) {
      promise.reject("CAPTURE_PERMISSION_MISSING", "Permission screen capture belum diberikan")
      return
    }

    val metrics = getRealDisplayMetrics()
    val outputDirectory = File(appContext.cacheDir, "captures").apply { mkdirs() }
    val outputFile = File(outputDirectory, "latest.png")

    capturePromise = promise
    captureCompleted = false

    try {
      ContextCompat.startForegroundService(
          appContext,
          Intent(appContext, OverlayService::class.java).apply {
            action = OverlayService.ACTION_START
          },
      )
      mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, Intent(data))
      imageReader = ImageReader.newInstance(
          metrics.widthPixels,
          metrics.heightPixels,
          PixelFormat.RGBA_8888,
          2,
      )
      virtualDisplay =
          mediaProjection?.createVirtualDisplay(
              "YomeruScreenCapture",
              metrics.widthPixels,
              metrics.heightPixels,
              metrics.densityDpi,
              DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
              imageReader?.surface,
              null,
              null,
          )
      startCaptureTimeout()

      imageReader?.setOnImageAvailableListener({ reader ->
        if (captureCompleted) {
          return@setOnImageAvailableListener
        }

        val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
        captureCompleted = true

        try {
          val plane = image.planes.firstOrNull()
              ?: throw IllegalStateException("Plane bitmap tidak tersedia")
          val buffer = plane.buffer
          val pixelStride = plane.pixelStride
          val rowStride = plane.rowStride
          val rowPadding = rowStride - pixelStride * metrics.widthPixels
          val bitmap =
              Bitmap.createBitmap(
                  metrics.widthPixels + rowPadding / pixelStride,
                  metrics.heightPixels,
                  Bitmap.Config.ARGB_8888,
              )
          bitmap.copyPixelsFromBuffer(buffer)
          val croppedBitmap =
              Bitmap.createBitmap(bitmap, 0, 0, metrics.widthPixels, metrics.heightPixels)

          FileOutputStream(outputFile).use { stream ->
            croppedBitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
            stream.flush()
          }

          Log.d(LOG_TAG, "[YomeruApp] Screenshot tersimpan di ${outputFile.absolutePath}")
          clearCaptureTimeout()
          capturePromise?.resolve(outputFile.absolutePath)
        } catch (error: Exception) {
          Log.e(LOG_TAG, "[YomeruApp] Gagal menyimpan screenshot", error)
          clearCaptureTimeout()
          capturePromise?.reject(
              "CAPTURE_FAILED",
              "Gagal menyimpan hasil screen capture: ${error.message}",
              error,
          )
        } finally {
          image.close()
          capturePromise = null
          releaseProjectionInternal()
        }
      }, mainHandler)
    } catch (error: Exception) {
      Log.e(LOG_TAG, "[YomeruApp] Gagal memulai screen capture", error)
      clearCaptureTimeout()
      capturePromise = null
      releaseProjectionInternal()
      promise.reject(
          "CAPTURE_FAILED",
          "Gagal memulai screen capture: ${error.message}",
          error,
      )
    }
  }

  @ReactMethod
  fun releaseProjection() {
    releaseProjectionInternal()
  }

  override fun invalidate() {
    super.invalidate()
    releaseProjectionInternal()
    appContext.removeActivityEventListener(activityEventListener)
  }

  private fun startCaptureTimeout() {
    clearCaptureTimeout()
    captureTimeoutRunnable =
        Runnable {
          if (captureCompleted) {
            return@Runnable
          }

          Log.e(LOG_TAG, "[YomeruApp] Screen capture timeout setelah 3 detik")
          capturePromise?.reject("CAPTURE_TIMEOUT", "Screen capture timeout setelah 3 detik")
          capturePromise = null
          releaseProjectionInternal()
        }

    mainHandler.postDelayed(captureTimeoutRunnable!!, CAPTURE_TIMEOUT_MS)
  }

  private fun clearCaptureTimeout() {
    captureTimeoutRunnable?.let(mainHandler::removeCallbacks)
    captureTimeoutRunnable = null
  }

  private fun releaseProjectionInternal() {
    clearCaptureTimeout()
    imageReader?.setOnImageAvailableListener(null, null)
    imageReader?.close()
    imageReader = null
    virtualDisplay?.release()
    virtualDisplay = null
    mediaProjection?.stop()
    mediaProjection = null
    appContext.stopService(
        Intent(appContext, OverlayService::class.java).apply {
          action = OverlayService.ACTION_STOP
        },
    )
  }

  private fun getRealDisplayMetrics(): DisplayMetrics {
    val metrics = DisplayMetrics()
    val windowManager = appContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager

    @Suppress("DEPRECATION")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      appContext.display?.getRealMetrics(metrics) ?: windowManager.defaultDisplay.getRealMetrics(metrics)
    } else {
      windowManager.defaultDisplay.getRealMetrics(metrics)
    }

    return metrics
  }

  companion object {
    private const val LOG_TAG = "YomeruApp"
    private const val REQUEST_CAPTURE_PERMISSION = 3145
    private const val CAPTURE_TIMEOUT_MS = 3000L
  }
}
