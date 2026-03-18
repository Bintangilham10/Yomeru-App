# CLAUDE.md — YomeruApp (Agentic Build Guide)

> Dokumen ini adalah instruksi eksekusi untuk Agentic AI (Claude Code atau sejenisnya).
> Baca seluruh file ini sebelum menyentuh satu baris kode pun.

---

## 0. Konteks Proyek

**Nama:** YomeruApp
**Tujuan:** Aplikasi Android overlay yang mendeteksi teks manga Jepang di layar secara real-time, lalu menimpa bubble teks asli dengan terjemahan Bahasa Indonesia/Inggris.
**Stack Utama:** React Native (bare workflow, BUKAN Expo Go) + Android Native Modules (Kotlin)
**Target OS:** Android 8.0+ (API 26+)
**Filosofi:** 100% gratis, on-device processing (offline-first), tidak ada subscription.

---

## 1. Perintah Global untuk Agen

```
JANGAN PERNAH:
- Menggunakan Expo Go atau managed workflow
- Menginstall library yang membutuhkan pembayaran/API key berbayar
- Membuat file di luar struktur direktori yang sudah didefinisikan di §3
- Skip penulisan unit test untuk Native Module
- Menggunakan `any` type di TypeScript tanpa komentar alasan

SELALU:
- Jalankan `./gradlew assembleDebug` setelah setiap perubahan Kotlin
- Jalankan `npx tsc --noEmit` setelah setiap perubahan TypeScript
- Tambahkan log dengan tag `[YomeruApp]` di setiap Native Module
- Tangani semua Promise rejection dengan pesan error yang informatif
- Tulis komentar Bahasa Indonesia untuk logika bisnis utama
```

---

## 2. Arsitektur Pipeline

```
[Floating Button - WindowManager]
         │ tap
         ▼
[ScreenCaptureModule - MediaProjection API]
         │ bitmap → file cache
         ▼
[OcrModule - ML Kit Text Recognition (JP)]
         │ TextBlock[] + BoundingBox[]
         ▼
[TranslationModule - ML Kit Translate (JP→ID)]
         │ TranslatedBubble[]
         ▼
[TranslationOverlay - React Native View]
         │ render teks di atas layar
         ▼
[Floating Button] ← tunggu tap berikutnya
```

**Catatan Koordinat Kritis:**
Bounding box dari ML Kit dalam satuan **piksel** (px), sedangkan React Native menggunakan satuan **dp** (density-independent pixels).
Rumus konversi: `dp = px / displayMetrics.density`
Lakukan konversi ini di sisi Kotlin sebelum mengirim data ke JS layer.

---

## 3. Struktur Direktori Target

```
YomeruApp/
├── CLAUDE.md                          ← file ini
├── android/
│   └── app/
│       ├── build.gradle               ← tambahkan ML Kit dependencies
│       └── src/main/
│           ├── AndroidManifest.xml    ← tambahkan permissions
│           └── java/com/yomeruapp/
│               ├── MainApplication.kt
│               ├── modules/
│               │   ├── OverlayModule.kt
│               │   ├── ScreenCaptureModule.kt
│               │   ├── OcrModule.kt
│               │   └── TranslationModule.kt
│               └── packages/
│                   └── YomeruAppPackage.kt
├── src/
│   ├── App.tsx
│   ├── hooks/
│   │   ├── useOverlay.ts
│   │   └── useTranslatePipeline.ts
│   ├── services/
│   │   ├── ocr.ts
│   │   ├── translation.ts
│   │   └── pipeline.ts
│   ├── components/
│   │   ├── TranslationOverlay.tsx
│   │   ├── FloatingButtonControl.tsx
│   │   └── PermissionGate.tsx
│   └── types/
│       └── index.ts
├── __tests__/
│   ├── services/
│   │   ├── pipeline.test.ts
│   │   └── translation.test.ts
│   └── components/
│       └── TranslationOverlay.test.tsx
└── tsconfig.json
```

---

## 4. Fase Eksekusi (Urutan Wajib)

### FASE 1 — Inisialisasi Proyek

```bash
# Inisialisasi bare React Native
npx react-native@latest init YomeruApp --template react-native-template-typescript
cd YomeruApp

# Verifikasi build awal berhasil sebelum lanjut
npx react-native run-android
```

**Cek keberhasilan Fase 1:**
- [ ] App default React Native tampil di emulator/device
- [ ] Tidak ada error Gradle

---

### FASE 2 — Permissions & Manifest

Edit `android/app/src/main/AndroidManifest.xml`, tambahkan di dalam `<manifest>`:

```xml
<!-- Draw over other apps -->
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

<!-- Screen capture -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />

<!-- Internet untuk fallback translation API -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Storage untuk cache screenshot -->
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="28" />
```

Tambahkan service di dalam `<application>`:

```xml
<service
    android:name=".services.OverlayService"
    android:foregroundServiceType="mediaProjection"
    android:exported="false" />
```

---

### FASE 3 — Dependencies Native (build.gradle)

Edit `android/app/build.gradle`, tambahkan di `dependencies {}`:

```gradle
// ML Kit OCR - Japanese
implementation 'com.google.mlkit:text-recognition-japanese:16.0.0'

// ML Kit On-Device Translation
implementation 'com.google.mlkit:translate:17.0.3'

// Coroutines untuk async Kotlin
implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.7.3'
```

Jalankan: `cd android && ./gradlew assembleDebug`

**Cek keberhasilan Fase 3:**
- [ ] Gradle sync berhasil tanpa error dependency
- [ ] APK terbuild (meski belum ada fitur baru)

---

### FASE 4 — Native Module: OverlayModule

Buat file: `android/app/src/main/java/com/yomeruapp/modules/OverlayModule.kt`

**Spesifikasi yang HARUS diimplementasi:**

| Method | Return | Deskripsi |
|--------|--------|-----------|
| `checkOverlayPermission()` | `Promise<Boolean>` | Cek apakah SYSTEM_ALERT_WINDOW granted |
| `requestOverlayPermission()` | `void` | Buka Settings untuk minta permission |
| `showFloatingButton()` | `void` | Tampilkan FAB yang bisa di-drag |
| `removeFloatingButton()` | `void` | Hapus FAB dari layar |
| `updateOverlayBubbles(data: String)` | `void` | Terima JSON array TranslatedBubble, render overlay teks |

**Event yang HARUS dikirim ke JS:**

| Event | Payload | Trigger |
|-------|---------|---------|
| `onCaptureRequested` | `null` | User tap FAB |
| `onOverlayPermissionChanged` | `{ granted: boolean }` | User kembali dari Settings |

**Ketentuan UI FAB:**
- Ukuran: 56×56 dp
- Posisi awal: kanan layar, tengah vertikal
- Warna: `#1a1a2e` dengan ikon kamera putih
- Draggable: ya, dengan snap ke tepi kiri/kanan layar saat dilepas
- Z-order: selalu di atas semua aplikasi lain

---

### FASE 5 — Native Module: ScreenCaptureModule

Buat file: `android/app/src/main/java/com/yomeruapp/modules/ScreenCaptureModule.kt`

**Spesifikasi:**

| Method | Return | Deskripsi |
|--------|--------|-----------|
| `requestCapturePermission()` | `Promise<String>` | Resolve `"granted"` atau reject |
| `captureScreen()` | `Promise<String>` | Resolve path file PNG di cache dir |
| `releaseProjection()` | `void` | Bebaskan MediaProjection resource |

**Ketentuan implementasi:**
- Simpan hasil capture di: `context.cacheDir/captures/latest.png`
- Overwrite file yang sama setiap capture (tidak perlu menyimpan history)
- Gunakan `ImageReader` dengan format `PixelFormat.RGBA_8888`
- Resolusi: sama dengan resolusi layar penuh (`displayMetrics.widthPixels × displayMetrics.heightPixels`)
- Setelah capture, panggil `releaseProjection()` secara otomatis untuk hemat baterai
- Timeout: jika capture tidak selesai dalam 3 detik, reject Promise

**PENTING — Siklus hidup MediaProjection:**
```
requestCapturePermission() → simpan resultCode + data
captureScreen() → buat MediaProjection baru dari token → ambil screenshot → destroy projection
```
Jangan menyimpan instance MediaProjection secara permanen.

---

### FASE 6 — Native Module: OcrModule

Buat file: `android/app/src/main/java/com/yomeruapp/modules/OcrModule.kt`

**Spesifikasi:**

| Method | Return | Deskripsi |
|--------|--------|-----------|
| `recognizeText(imagePath: String)` | `Promise<OcrResult>` | Jalankan OCR pada file gambar |

**Struktur OcrResult (kirim sebagai WritableNativeMap):**

```kotlin
// Yang dikirim ke JS:
{
  "fullText": String,          // Semua teks digabung
  "blocks": [                  // Array text block (per bubble)
    {
      "text": String,
      "left": Int,             // Sudah dikonversi ke dp
      "top": Int,              // Sudah dikonversi ke dp
      "width": Int,            // Sudah dikonversi ke dp
      "height": Int,           // Sudah dikonversi ke dp
      "confidence": Float      // 0.0 - 1.0
    }
  ]
}
```

**Filter wajib sebelum mengirim ke JS:**
- Buang block dengan `confidence < 0.6`
- Buang block dengan teks kurang dari 2 karakter
- Buang block yang berada di luar batas layar

**Rekognizer yang digunakan:**
```kotlin
TextRecognition.getClient(JapaneseTextRecognizerOptions.Builder().build())
```

---

### FASE 7 — Native Module: TranslationModule

Buat file: `android/app/src/main/java/com/yomeruapp/modules/TranslationModule.kt`

**Spesifikasi:**

| Method | Return | Deskripsi |
|--------|--------|-----------|
| `downloadModelIfNeeded()` | `Promise<Boolean>` | Download model JP→ID (hanya sekali, via WiFi) |
| `isModelDownloaded()` | `Promise<Boolean>` | Cek apakah model sudah tersedia |
| `translate(text: String)` | `Promise<String>` | Terjemahkan satu string |
| `translateBatch(textsJson: String)` | `Promise<String>` | Terjemahkan array teks (JSON string), return JSON string |

**Ketentuan:**
- Source: `TranslateLanguage.JAPANESE`
- Target: `TranslateLanguage.INDONESIAN`
- `translateBatch` mengeksekusi semua terjemahan secara paralel dengan Kotlin Coroutines
- Jika model belum diunduh, `translate()` harus reject dengan pesan `"MODEL_NOT_READY"`
- Jangan download model secara otomatis di background tanpa izin user

---

### FASE 8 — Package Registrar

Buat file: `android/app/src/main/java/com/yomeruapp/packages/YomeruAppPackage.kt`

```kotlin
class YomeruAppPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(
        OverlayModule(ctx),
        ScreenCaptureModule(ctx),
        OcrModule(ctx),
        TranslationModule(ctx)
    )
    override fun createViewManagers(ctx: ReactApplicationContext) = emptyList<ViewManager<*, *>>()
}
```

Daftarkan di `MainApplication.kt`:
```kotlin
override fun getPackages() = PackageList(this).packages.apply {
    add(YomeruAppPackage())
}
```

---

### FASE 9 — TypeScript Layer

**`src/types/index.ts`**

```typescript
export interface TextBlock {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
}

export interface OcrResult {
  fullText: string;
  blocks: TextBlock[];
}

export interface TranslatedBubble {
  originalText: string;
  translatedText: string;
  position: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export type PipelineStatus =
  | 'idle'
  | 'capturing'
  | 'recognizing'
  | 'translating'
  | 'displaying'
  | 'error';
```

**`src/services/pipeline.ts`**

Implementasi fungsi `runTranslatePipeline()`:
1. Panggil `ScreenCaptureModule.captureScreen()` → dapatkan `imagePath`
2. Panggil `OcrModule.recognizeText(imagePath)` → dapatkan `OcrResult`
3. Filter block: hanya yang `text.trim().length >= 2`
4. Panggil `TranslationModule.translateBatch(JSON.stringify(texts))` → dapatkan terjemahan
5. Gabungkan posisi dari OCR dengan teks terjemahan → return `TranslatedBubble[]`
6. Handle error di setiap langkah, lempar error dengan pesan yang spesifik

**`src/hooks/useTranslatePipeline.ts`**

State yang dikelola:
```typescript
{
  status: PipelineStatus;
  bubbles: TranslatedBubble[];
  error: string | null;
  isModelReady: boolean;
}
```

Expose fungsi:
- `runPipeline()` — jalankan full pipeline
- `clearBubbles()` — hapus overlay
- `downloadModel()` — trigger download model terjemahan

---

### FASE 10 — React Native Components

**`src/components/PermissionGate.tsx`**

Tampilkan UI onboarding yang meminta dua permission secara berurutan:
1. **Draw Over Other Apps** — dengan tombol "Buka Pengaturan"
2. **Screen Capture** — dengan tombol "Izinkan" yang trigger MediaProjection dialog

Jangan lanjut ke MainScreen sebelum kedua permission granted.

**`src/components/TranslationOverlay.tsx`**

- Gunakan `StyleSheet.absoluteFill` dengan `pointerEvents="none"`
- Setiap bubble: background putih 92% opacity, border-radius 8, padding 6
- Font size adaptif: mulai dari 12, turun jika teks panjang (gunakan `adjustsFontSizeToFit`)
- Tambahkan animasi fade-in 200ms saat bubble muncul

**`src/App.tsx`**

Alur screen:
```
PermissionGate → [jika granted] → MainScreen
```

MainScreen hanya menampilkan:
- Status indicator (idle/capturing/dll)
- Tombol "Download Model Terjemahan" jika model belum ada
- Instruksi singkat cara pakai

Semua kontrol utama ada di FAB overlay (dikelola OverlayModule di sisi native).

---

## 5. Testing Requirements

Setiap fase HARUS diverifikasi dengan test berikut sebelum lanjut ke fase berikutnya:

### Unit Tests (Jest)
```bash
npx jest --coverage
# Coverage minimum: 70% untuk semua file di src/services/
```

### Manual Test Checklist per Fase

**Fase 4 (Overlay):**
- [ ] FAB muncul di atas aplikasi Mihon
- [ ] FAB bisa di-drag ke mana saja
- [ ] FAB snap ke tepi kiri/kanan saat dilepas
- [ ] Tap FAB mengirim event ke JS (verifikasi dengan console.log)

**Fase 5 (Screen Capture):**
- [ ] File PNG tersimpan di cache dir
- [ ] File bisa dibuka/dilihat (tidak corrupt)
- [ ] Capture terjadi < 2 detik

**Fase 6 (OCR):**
- [ ] Teks Jepang terdeteksi dari screenshot manga
- [ ] Bounding box sesuai posisi teks di layar
- [ ] Tidak ada crash pada gambar tanpa teks

**Fase 7 (Translation):**
- [ ] Model terunduh (cek: `< 100MB`)
- [ ] Terjemahan JP→ID menghasilkan kalimat yang masuk akal
- [ ] `translateBatch` lebih cepat dari loop serial

**Fase 9-10 (Full Pipeline):**
- [ ] Tap FAB → bubble terjemahan muncul di posisi yang tepat dalam < 5 detik
- [ ] Bubble tidak menghalangi tap/swipe pada aplikasi di bawahnya
- [ ] Tap FAB kedua kali → bubble lama hilang, proses ulang

---

## 6. Penanganan Edge Cases

Implementasi HARUS menangani kondisi-kondisi berikut:

| Kondisi | Penanganan |
|---------|------------|
| Layar gelap/blank saat capture | OCR return `blocks: []`, overlay tidak ditampilkan |
| Teks bukan Jepang terdeteksi | Filter di OcrModule: skip block yang tidak mengandung karakter CJK |
| Model belum diunduh | Fallback ke MyMemory API (fetch ke `api.mymemory.translated.net`) |
| Tidak ada koneksi internet + model belum ada | Tampilkan toast "Unduh model terjemahan dulu saat ada WiFi" |
| Permission dicabut oleh user | Overlay Module deteksi via `onWindowFocusChanged`, kirim event `onPermissionRevoked` |
| App Mihon di-minimize saat pipeline berjalan | Cancel pipeline, jangan render overlay |

---

## 7. Optimisasi Performa

Terapkan optimisasi ini setelah semua fase berjalan:

1. **Debounce capture:** Minimal 1.5 detik antara dua tap FAB
2. **Bitmap downscale:** Resize screenshot ke 50% sebelum kirim ke OCR jika resolusi > 1080p
3. **Cache terjemahan:** Simpan hasil terjemahan dalam `Map<string, string>` di memory — jika teks yang sama muncul lagi, gunakan cache
4. **Lazy load TranslationModule:** Inisialisasi translator hanya saat pertama kali dibutuhkan
5. **Cleanup:** Hapus file PNG dari cache setelah pipeline selesai

---

## 8. Konfigurasi Build Final

Pastikan `android/app/build.gradle` memiliki:

```gradle
android {
    compileSdkVersion 34
    defaultConfig {
        minSdkVersion 26
        targetSdkVersion 34
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = '17'
    }
}
```

---

## 9. Perintah Berguna

```bash
# Build dan install debug APK
npx react-native run-android

# Build release APK
cd android && ./gradlew assembleRelease

# Lihat log Native Module
adb logcat -s "YomeruApp"

# Clear cache jika ada masalah aneh
cd android && ./gradlew clean && cd .. && npx react-native start --reset-cache

# Cek apakah ML Kit model sudah diunduh
adb shell ls /data/data/com.yomeruapp/files/

# TypeScript check
npx tsc --noEmit

# Run tests
npx jest --watchAll
```

---

## 10. Definisi "Done"

Proyek dianggap selesai jika:

- [ ] Semua 10 Fase telah dieksekusi
- [ ] Semua manual test checklist ter-centang
- [ ] `npx tsc --noEmit` exit code 0
- [ ] `npx jest --coverage` menunjukkan coverage ≥ 70%
- [ ] APK bisa diinstall di Android 8.0 fresh (tanpa Play Services khusus)
- [ ] Full pipeline (tap FAB → overlay muncul) selesai dalam < 5 detik di device mid-range
- [ ] Tidak ada memory leak setelah 10x penggunaan berturut-turut (verifikasi via Android Profiler)
