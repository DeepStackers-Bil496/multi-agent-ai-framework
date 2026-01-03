# Colabda bunlari yorum satirindan cikarak calistirin
#!pkill ollama
#!pkill ngrok
#!pip install pyngrok
#!curl -fsSL https://ollama.com/install.sh | sh

import os
import threading
import time
import subprocess
from pyngrok import ngrok, conf

# --- AYARLAR ---
NGROK_AUTH_TOKEN = "37kVEwa8EZtr5XhBqWf3FQAnkN2_4WhXosh1h74P7iocrdu8L" # Tokenını buraya yapıştır

# İstediğin modelleri buraya LİSTE olarak yaz:
# Öneri: Bir tane kodlama, bir tane genel zeka, bir tane hızlı model olsun.
MODELS_TO_PULL = [
    "gpt-oss:20b",
    "qwen2.5:14b"         # Google'ın modeli
]
# ---------------

# 2. Ngrok yetkilendirmesi
conf.get_default().auth_token = NGROK_AUTH_TOKEN

# 3. Ortam Değişkenleri (CORS ve Host ayarı)
my_env = os.environ.copy()
my_env["OLLAMA_ORIGINS"] = "*"
my_env["OLLAMA_HOST"] = "0.0.0.0"

# 4. Ollama server'ı başlat
def start_ollama_server():
    print("Ollama server başlatılıyor...")
    subprocess.Popen(["ollama", "serve"], env=my_env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

ollama_thread = threading.Thread(target=start_ollama_server)
ollama_thread.start()

time.sleep(10) # Server kendine gelsin

# 5. Modelleri Döngü ile İndir
print(f"Toplam {len(MODELS_TO_PULL)} model indirilecek. Bu biraz sürebilir...")

for model in MODELS_TO_PULL:
    print(f"⬇️ İndiriliyor: {model} ...")
    subprocess.run(["ollama", "pull", model], env=my_env)
    print(f"✅ {model} hazır!")

# 6. Tüneli aç
try:
    public_url = ngrok.connect(11434).public_url
    print("\n" + "="*50)
    print(f"🔥 TÜM MODELLER HAZIR! API Adresi:")
    print(f"\n👉 {public_url} 👈\n")
    print(f"Kullanılabilir Modeller: {', '.join(MODELS_TO_PULL)}")
    print("="*50)

except Exception as e:
    print("Hata:", e)

# Döngü
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    ngrok.kill()