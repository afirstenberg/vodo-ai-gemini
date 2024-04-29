const recordButton = document.getElementById('recordButton');
const textInput = document.getElementById('textInput');
const chatArea = document.getElementById('chatArea');
const typingIndicator = document.getElementById('typingIndicator');

const recordQuestion = document.getElementById('recordQuestion');
const recordBan = document.getElementById('recordBan');

const sessionId = `web-${Date.now().valueOf()}-${Math.random()}`;

let mediaRecorder;
let recordedChunks = [];

async function blobToBase64(blob) {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const url = reader.result;
      const comma = url.indexOf(',');
      const b64 = url.substring(comma+1);
      resolve(b64);
    }
    reader.readAsDataURL(blob);
  });
}

async function sendText(msg){
  displayMessage(msg, 'user');

  typingIndicator.style.display = null;
  chatArea.scrollTop = chatArea.scrollHeight; // Scroll to bottom

  const response = await firebase.functions().httpsCallable('clientMsg')({
    sessionId,
    msg,
  })

  typingIndicator.style.display = 'none';

  const reply = response.data.reply;
  displayMessage(reply, 'vodo');
}

async function sendAudio(audioBlob){
  typingIndicator.style.display = null;
  chatArea.scrollTop = chatArea.scrollHeight; // Scroll to bottom

  const audio64 = await blobToBase64( audioBlob );
  const response = await firebase.functions().httpsCallable('clientAudio')({
    sessionId,
    audio64,
  })

  console.log(response.data);

  typingIndicator.style.display = 'none';

  const msg = response.data.msg;
  displayMessage(msg, 'user');

  const reply = response.data.reply;
  displayMessage(reply, 'vodo', {
    replyAudio: response.data.replyAudio
  });
}

recordButton.addEventListener('click', async () => {
  if (!mediaRecorder) {
    // Start recording if not already recording
    try{
      recordQuestion.classList.remove('hide');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordQuestion.classList.add('hide');
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = event => recordedChunks.push(event.data);
      mediaRecorder.onstop = async () => {
        console.log('media on stop');
        recordButton.classList.remove('recording');
        const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
        recordedChunks = []; // Reset chunks
        await sendAudio(audioBlob);
        textInput.focus();
      };

      mediaRecorder.start();
      recordButton.classList.add('recording');

    } catch( xx ){
      recordQuestion.classList.add('hide');
      recordBan.classList.remove('hide');
      console.error('Error accessing microphone:', xx)
    }

  } else {
    // Stop recording
    mediaRecorder.stop();
    mediaRecorder = null;
  }
})

textInput.addEventListener('keydown', async (event) => {
  if (event.key === 'Enter' && textInput.value.trim() !== '') {
    const msg = textInput.value;
    textInput.value = '';
    await sendText(msg);
  }
});

function addHtml(element, html){
  const parser = new DOMParser();
  const doc = parser.parseFromString( html, "text/html" );
  const newElement = doc.body.firstChild;
  element.appendChild( newElement );
  return newElement;
}

function displayMessage(text, sender, opts) {
  const options = opts ?? {};

  const messageElement = document.createElement('div');
  messageElement.classList.add('message', sender);

  // Add icon element
  const iconElement = document.createElement('div');
  iconElement.classList.add('icon');
  messageElement.appendChild(iconElement);

  // Add text element
  const textElement = document.createElement('div');
  textElement.classList.add('text');
  textElement.textContent = text;
  messageElement.appendChild(textElement);

  const etcElement = document.createElement('div');
  etcElement.classList.add('etc');
  messageElement.appendChild(etcElement);

  if( options.replyAudio ){
    const audio = new Audio(`data:audio/mp3;base64,${opts.replyAudio}`);
    etcElement.appendChild(audio);
    audio.play();
    const audioIcon = addHtml(
      etcElement,
      '<i class="fa-solid fa-volume-high"></i>'
    )
    audioIcon.onclick = () => {
      audio.play();
      textInput.focus();
    }
  }

  chatArea.insertBefore(messageElement, typingIndicator);
  chatArea.scrollTop = chatArea.scrollHeight; // Scroll to bottom
}
