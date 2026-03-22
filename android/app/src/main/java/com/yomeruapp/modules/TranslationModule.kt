package com.yomeruapp.modules

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONArray

class TranslationModule(private val appContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(appContext) {

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val remoteModelManager = RemoteModelManager.getInstance()
  private val sourceModel = TranslateRemoteModel.Builder(TranslateLanguage.JAPANESE).build()
  private val targetModel = TranslateRemoteModel.Builder(TranslateLanguage.INDONESIAN).build()

  @Volatile
  private var translator: Translator? = null

  override fun getName(): String = "TranslationModule"

  @ReactMethod
  fun downloadModelIfNeeded(promise: Promise) {
    val translatorInstance = getTranslator()
    val conditions = DownloadConditions.Builder().requireWifi().build()

    translatorInstance
        .downloadModelIfNeeded(conditions)
        .addOnSuccessListener {
          Log.d(LOG_TAG, "[YomeruApp] Model JP->ID siap digunakan")
          promise.resolve(true)
        }
        .addOnFailureListener { error ->
          Log.e(LOG_TAG, "[YomeruApp] Gagal mengunduh model terjemahan", error)
          promise.reject(
              "MODEL_DOWNLOAD_FAILED",
              "Gagal mengunduh model terjemahan: ${error.message}",
              error,
          )
        }
  }

  @ReactMethod
  fun isModelDownloaded(promise: Promise) {
    scope.launch {
      try {
        val sourceReady = remoteModelManager.isModelDownloaded(sourceModel).await()
        val targetReady = remoteModelManager.isModelDownloaded(targetModel).await()
        promise.resolve(sourceReady && targetReady)
      } catch (error: Exception) {
        Log.e(LOG_TAG, "[YomeruApp] Gagal mengecek status model", error)
        promise.reject(
            "MODEL_STATUS_FAILED",
            "Gagal mengecek status model terjemahan: ${error.message}",
            error,
        )
      }
    }
  }

  @ReactMethod
  fun translate(text: String, promise: Promise) {
    scope.launch {
      try {
        ensureModelReady()
        val translated = getTranslator().translate(text).await()
        promise.resolve(translated)
      } catch (error: Exception) {
        handleTranslationError(promise, error)
      }
    }
  }

  @ReactMethod
  fun translateBatch(textsJson: String, promise: Promise) {
    scope.launch {
      try {
        ensureModelReady()
        val payload = JSONArray(textsJson)
        val texts = List(payload.length()) { index -> payload.getString(index) }
        val translatorInstance = getTranslator()
        val translated =
            texts
                .map { text ->
                  async {
                    translatorInstance.translate(text).await()
                  }
                }
                .awaitAll()
        promise.resolve(JSONArray(translated).toString())
      } catch (error: Exception) {
        handleTranslationError(promise, error)
      }
    }
  }

  override fun invalidate() {
    super.invalidate()
    translator?.close()
    translator = null
    scope.cancel()
  }

  private suspend fun ensureModelReady() {
    val sourceReady = remoteModelManager.isModelDownloaded(sourceModel).await()
    val targetReady = remoteModelManager.isModelDownloaded(targetModel).await()

    if (!sourceReady || !targetReady) {
      throw IllegalStateException("MODEL_NOT_READY")
    }
  }

  private fun getTranslator(): Translator {
    val existing = translator
    if (existing != null) {
      return existing
    }

    val created =
        Translation.getClient(
            TranslatorOptions.Builder()
                .setSourceLanguage(TranslateLanguage.JAPANESE)
                .setTargetLanguage(TranslateLanguage.INDONESIAN)
                .build(),
        )
    translator = created
    return created
  }

  private fun handleTranslationError(promise: Promise, error: Exception) {
    if (error.message?.contains("MODEL_NOT_READY") == true) {
      promise.reject("MODEL_NOT_READY", "MODEL_NOT_READY", error)
      return
    }

    Log.e(LOG_TAG, "[YomeruApp] Gagal menerjemahkan teks", error)
    promise.reject("TRANSLATION_FAILED", "Terjemahan gagal: ${error.message}", error)
  }

  companion object {
    private const val LOG_TAG = "YomeruApp"
  }
}
