import os
import time
import subprocess
import threading
from pyngrok import ngrok, conf

# --- 1. CONFIGURATION ---
NGROK_AUTH_TOKEN = "37kVEwa8EZtr5XhBqWf3FQAnkN2_4WhXosh1h74P7iocrdu8L" 
MODELS_TO_PULL = ["glm-4.7-flash:latest"] 

# Authenticate
conf.get_default().auth_token = NGROK_AUTH_TOKEN

# --- 2. CLEANUP ---
print("🧹 Killing old processes...")
os.system("pkill ollama")
ngrok.kill()
time.sleep(2)

# --- 3. ENVIRONMENT SETTINGS ---
# We set origins to "*" to allow browser access
my_env = os.environ.copy()
my_env["OLLAMA_ORIGINS"] = "*"
my_env["OLLAMA_HOST"] = "0.0.0.0:11434"

# --- 4. START OLLAMA ---
def start_ollama():
    print("🚀 Starting Ollama...")
    subprocess.Popen(["ollama", "serve"], env=my_env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

thread = threading.Thread(target=start_ollama)
thread.start()
time.sleep(5) # Give it time to start

# --- 5. START NGROK (THE FIX IS HERE) ---
try:
    # host_header="rewrite" tricks Ollama into thinking the request is local
    public_url = ngrok.connect(11434, host_header="rewrite").public_url
    
    print("\n" + "="*50)
    print(f"🔥 SUCCESS! NEW URL (403 Fixed):")
    print(f"\n👉 {public_url} 👈\n")
    print("="*50)

    # Pull models after server is up
    for model in MODELS_TO_PULL:
        print(f"⬇️  Checking model: {model}...")
        subprocess.run(["ollama", "pull", model], env=my_env)
        print(f"✅ {model} ready!")

    # Keep alive
    while True:
        time.sleep(1)

except Exception as e:
    print(f"❌ Error: {e}")