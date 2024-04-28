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
    displayMessage(reply, 'server');
  }
});

function displayMessage(text, sender) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', sender); // Add 'user' or 'server' class
  messageElement.textContent = text;
  chatArea.appendChild(messageElement);
  chatArea.scrollTop = chatArea.scrollHeight; // Scroll to bottom
}
