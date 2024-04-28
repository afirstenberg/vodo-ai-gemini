const recordButton = document.getElementById('recordButton');
const textInput = document.getElementById('textInput');
const chatArea = document.getElementById('chatArea');
const apiUrl = 'YOUR_API_URL';

// Recording logic (you'll need a library like Recorder.js or similar)
recordButton.addEventListener('click', async () => {
  // TODO - get audio
  const audioData = "" /* ... */;

  // Send audio to server and handle response
  const response = await fetch(apiUrl, {
    method: 'POST',
    body: audioData
  });
  const text = await response.text();

  // Display message in chat
  displayMessage(text, 'server');
});

const sessionId = `web-${Date.now().valueOf()}-${Math.random()}`;

textInput.addEventListener('keydown', async (event) => {
  if (event.key === 'Enter' && textInput.value.trim() !== '') {
    // Send text message to server and display it
    displayMessage(textInput.value, 'user');

    // Clear input field
    const msg = textInput.value;
    textInput.value = '';

    // Fetch and display server's response
    /*
    fetch(apiUrl, {
      method: 'POST',
      body: textInput.value
    }).then(response => response.text())
      .then(text => displayMessage(text, 'server'));
    */
    const response = await firebase.functions().httpsCallable('clientMsg')({
      sessionId,
      msg,
    })
    const reply = response.data.reply;
    console.log(response);
    displayMessage(reply, 'vodo');
  }
});

function displayMessage(text, sender) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', sender);

  // Add icon element
  const iconElement = document.createElement('div');
  iconElement.classList.add('icon');
  // Add your icon image or placeholder here
  messageElement.appendChild(iconElement);

  // Add text element
  const textElement = document.createElement('div');
  textElement.classList.add('text');
  textElement.textContent = text;
  messageElement.appendChild(textElement);

  chatArea.appendChild(messageElement);
  chatArea.scrollTop = chatArea.scrollHeight; // Scroll to bottom
}
