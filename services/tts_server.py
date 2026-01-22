import io
import os

import soundfile as sf
import torch
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel
from transformers import AutoTokenizer, VitsModel

MODEL_ID = os.getenv("TTS_MODEL_ID", "facebook/mms-tts-tur")
DEVICE = os.getenv("TTS_DEVICE", "cpu")
MAX_CHARS = int(os.getenv("TTS_MAX_CHARS", "2000"))

app = FastAPI()

tokenizer: AutoTokenizer | None = None
model: VitsModel | None = None


class TTSRequest(BaseModel):
    text: str


@app.on_event("startup")
def load_model() -> None:
    global tokenizer, model
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = VitsModel.from_pretrained(MODEL_ID)
    model.to(DEVICE)
    model.eval()


@app.post("/synthesize")
def synthesize(request: TTSRequest) -> Response:
    if not model or not tokenizer:
        raise HTTPException(status_code=503, detail="Model not loaded")

    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    if len(text) > MAX_CHARS:
        raise HTTPException(status_code=400, detail="Text is too long")

    inputs = tokenizer(text, return_tensors="pt")
    inputs = {key: value.to(DEVICE) for key, value in inputs.items()}

    with torch.no_grad():
        waveform = model(**inputs).waveform

    audio = waveform.squeeze().cpu().numpy()
    sample_rate = model.config.sampling_rate

    buffer = io.BytesIO()
    sf.write(buffer, audio, sample_rate, format="WAV")

    return Response(content=buffer.getvalue(), media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("TTS_PORT", "8005"))
    uvicorn.run(app, host="0.0.0.0", port=port)
