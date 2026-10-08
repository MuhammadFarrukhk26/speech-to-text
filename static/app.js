const recordButton = document.querySelector("#record-button");
const recordLabel = document.querySelector("#record-label");
const recordHint = document.querySelector("#record-hint");
const fileInput = document.querySelector("#audio-file");
const fileName = document.querySelector("#file-name");
const audioPreview = document.querySelector("#audio-preview");
const transcribeButton = document.querySelector("#transcribe-button");
const copyButton = document.querySelector("#copy-button");
const status = document.querySelector("#status");
const result = document.querySelector("#result");

let selectedAudio = null;
let mediaRecorder = null;
let audioChunks = [];
let previewUrl = null;
let microphoneStream = null;

function setSelectedAudio(file) {
  selectedAudio = file;
  fileInput.value = "";
  fileName.textContent = file ? file.name : "";
  transcribeButton.disabled = !file;
  status.textContent = "";
  audioPreview.hidden = !file;

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  if (file) {
    previewUrl = URL.createObjectURL(file);
    audioPreview.src = previewUrl;
  } else {
    audioPreview.removeAttribute("src");
  }
}

function extensionForMimeType(mimeType) {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) setSelectedAudio(file);
});

recordButton.addEventListener("click", async () => {
  if (mediaRecorder?.state === "recording") {
    mediaRecorder.stop();
    recordLabel.textContent = "Start recording";
    recordButton.classList.remove("is-recording");
    recordHint.textContent = "Recording stopped. You can listen before transcribing.";
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    status.textContent = "This browser does not support microphone recording. Please upload an audio file instead.";
    return;
  }

  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(microphoneStream);
    audioChunks = [];
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    });
    mediaRecorder.addEventListener("stop", () => {
      const mimeType = mediaRecorder.mimeType || "audio/webm";
      const audio = new Blob(audioChunks, { type: mimeType });
      setSelectedAudio(new File([audio], `recording.${extensionForMimeType(mimeType)}`, { type: mimeType }));
      microphoneStream?.getTracks().forEach((track) => track.stop());
      microphoneStream = null;
    }, { once: true });
    mediaRecorder.start();
    setSelectedAudio(null);
    recordLabel.textContent = "Stop recording";
    recordButton.classList.add("is-recording");
    recordHint.textContent = "Recording… select Stop recording when you are done.";
    status.textContent = "";
  } catch (error) {
    status.textContent = error instanceof Error
      ? `Could not access the microphone: ${error.message}`
      : "Could not access the microphone. Check your browser permissions.";
  }
});

transcribeButton.addEventListener("click", async () => {
  if (!selectedAudio) return;

  const formData = new FormData();
  formData.append("file", selectedAudio);
  transcribeButton.disabled = true;
  copyButton.disabled = true;
  status.textContent = "Transcribing… The first request may take longer while the Urdu model loads.";
  result.textContent = "";

  try {
    const response = await fetch("/api/transcribe", { method: "POST", body: formData });
    const responseText = await response.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(response.ok
        ? "The server returned an invalid response. Please try again."
        : `The server failed with status ${response.status}. Check the server output for details.`);
    }
    if (!response.ok) throw new Error(data.detail || "Transcription failed. Please try again.");
    result.textContent = data.text || "No speech detected.";
    copyButton.disabled = !data.text;
    status.textContent = "Transcription complete.";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Transcription failed. Please try again.";
  } finally {
    transcribeButton.disabled = !selectedAudio;
  }
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(result.textContent);
    status.textContent = "Text copied to clipboard.";
  } catch {
    status.textContent = "Could not copy automatically. Select the text and copy it manually.";
  }
});
