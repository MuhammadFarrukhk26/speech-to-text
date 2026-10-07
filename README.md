# Urdu Voice Transcriber

A local web app for recording Urdu speech in the browser or uploading an audio file, then transcribing it with `faster-whisper`.

## Run locally

1. From this folder, install the dependencies:

   ```powershell
   python -m pip install -r requirements.txt
   ```

   The requirements pin PyAV below version 19 because `faster-whisper` currently calls a PyAV API that changed in version 19.

2. Start the server:

   ```powershell
   python -m uvicorn app:app --host 127.0.0.1 --port 8000
   ```

3. Open <http://127.0.0.1:8000>.

The browser asks for microphone permission when you start a recording. Microphone recording requires a secure browser context; `localhost` is supported. Uploaded audio is limited to 25 MB. The first transcription downloads the `small` Whisper model and may take a while; the model is then kept in memory while the server runs. The server processes audio in a temporary folder and removes it after the request.

To allow other devices on your network to access the app, bind Uvicorn to `0.0.0.0` instead of `127.0.0.1`. Use HTTPS when exposing it beyond localhost.
