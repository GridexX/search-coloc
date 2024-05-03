const { Ollama } = require('ollama');

const host = 'https://chat.crocc.meso.umontpellier.fr/ollama';
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijc0NDUxYjNhLTBhYjctNGVkYy1iMzQ4LWRiZDZiNWMzYjJmNSJ9.MT0rJXexaAj0P_jK_PLb19byT4UuxNgfhZx_DD4pSQc";



const ollama = new Ollama({ host, fetch headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': "application/json" } })

async function main() {

  const response = await ollama.chat({
    model: 'mixtral:8x7b-instruct-v0.1-q5_0',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': "application/json" },
    messages: [{ role: 'user', content: 'Why is the sky blue?' }],
  })
  console.log(response.message.content)
}

main()