from flask import Flask, request
import ollama
from langchain_community.chat_models import ChatOllama
from langchain_core.messages import HumanMessage

app = Flask(__name__)

LLM_MODEL = "mixtral:8x7b-instruct-v0.1-q5_0"
LLM_JWT_BEARER = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijc0NDUxYjNhLTBhYjctNGVkYy1iMzQ4LWRiZDZiNWMzYjJmNSJ9.MT0rJXexaAj0P_jK_PLb19byT4UuxNgfhZx_DD4pSQc"
LLM_API_URL = "https://chat.crocc.meso.umontpellier.fr/ollama"

llm = ChatOllama(model=LLM_MODEL, base_url=LLM_API_URL,
headers={"Authorization": "Bearer " + LLM_JWT_BEARER, "Content-Type":
"application/json",})

@app.route('/api/ask', methods=['POST'])
def ask_model():
  user_input = request.json.get('content')
  messages = [HumanMessage(content=user_input)]
  chat_model_response = llm.invoke(messages)
  # Extract the content of the response and return it
  return chat_model_response.json()

if __name__ == '__main__':
  # Run the app on the port 5000
  app.run(port=5000, debug=True)

 