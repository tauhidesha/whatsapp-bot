import requests
import json
import os

BASE_URL = "http://34.23.238.197:4000"
GEMINI_API_KEY = os.environ.get("GOOGLE_API_KEY", "AIzaSyALnE-sJ-qjnRWini7fS2jPddDVF8rIV_I")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

def clear_session(thread_id: str):
    headers = {"x-internal-secret": "b7e1df6e31165c41ad52151c7b8c1864a51155fb99c5200405ca096bd744a7af"}
    requests.delete(f"{BASE_URL}/test-ai/clear", json={"thread_id": thread_id}, headers=headers, timeout=10)

def send_chat(thread_id: str, message: str) -> str:
    headers = {"x-internal-secret": "b7e1df6e31165c41ad52151c7b8c1864a51155fb99c5200405ca096bd744a7af"}
    resp = requests.post(f"{BASE_URL}/test-ai", json={"thread_id": thread_id, "message": message}, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json().get("ai_response", "")

def assert_semantic(reply: str, assertion: str, context: str = "") -> None:
    prompt = f"""
You are a strict QA evaluator. Evaluate if the AI's reply meets the assertion criteria.
Respond ONLY with a JSON object: {{"pass": boolean, "reason": "string"}}

Context: {context}
Assertion: {assertion}
AI Reply: {reply}
"""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    resp = requests.post(GEMINI_URL, json=payload, headers={"Content-Type": "application/json"}, timeout=30)
    resp.raise_for_status()
    try:
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        # Extract JSON
        start = text.find('{')
        end = text.rfind('}') + 1
        result = json.loads(text[start:end])
        assert result["pass"] is True, f"Semantic Assertion Failed: {result['reason']} | Bot Reply: {reply}"
    except Exception as e:
        if isinstance(e, AssertionError):
            raise e
        print(f"Evaluation error: {e}")
        assert False, f"Failed to evaluate: {e}"

def test_scenario_a_repaint_bodi_halus_upsell():
    thread_id = "test_sprite_a"
    clear_session(thread_id)
    
    reply1 = send_chat(thread_id, "mas mau repaint nmax")
    assert_semantic(reply1, "Bot MUST NOT give a price. Bot MUST ask which part to repaint OR ask for the color.")
    
    reply2 = send_chat(thread_id, "bodi halus warna merah candy")
    assert_semantic(reply2, "Bot provides the price. Bot MUST mention the extra surcharge for 'Candy' color. Bot MUST explicitly suggest/upsell 'Cuci Komplit'.")

def test_scenario_b_repaint_velg_constraint():
    thread_id = "test_sprite_b"
    clear_session(thread_id)
    
    reply1 = send_chat(thread_id, "mau repaint velg vario 150 warna gold")
    assert_semantic(reply1, "Bot MUST NOT give a price. Bot MUST ask about the current condition of the velg (whether it's original paint or has been repainted before).")
    
    reply2 = send_chat(thread_id, "udah pernah direpaint om")
    assert_semantic(reply2, "Bot provides the price. Bot MUST inform the user about the extra surcharge for 'Paint Remover' / rontok cat.")

def test_scenario_c_objection_handling():
    thread_id = "test_sprite_c"
    clear_session(thread_id)
    
    reply1 = send_chat(thread_id, "poles bodi aerox berapa?")
    assert_semantic(reply1, "Bot asks for the paint type (Glossy or Doff).")
    
    reply2 = send_chat(thread_id, "warna glossy")
    assert_semantic(reply2, "Bot provides the price.")
    
    reply3 = send_chat(thread_id, "waduh jauh om rumah saya di bekasi, nanti dulu deh nabung dulu")
    assert_semantic(reply3, "Bot MUST respond with empathy and warmth. Bot is STRICTLY FORBIDDEN from asking when the user wants to book or forcing a transaction.")

def test_scenario_d_anti_coating_on_repaint():
    thread_id = "test_sprite_d"
    clear_session(thread_id)
    
    reply1 = send_chat(thread_id, "om mau repaint bodi halus nmax warna hitam doff sama sekalian di coating bisa?")
    assert_semantic(reply1, "Bot provides the repaint price. Bot MUST educate the user that new paint cannot be coated immediately because it needs a 1-month curing time. Bot MUST NOT offer coating. Bot MUST suggest 'Cuci Komplit' instead.")

def test_scenario_e_multi_motor_focus():
    thread_id = "test_sprite_e"
    clear_session(thread_id)
    
    reply1 = send_chat(thread_id, "om mau nanya dong, kalau repaint bodi halus nmax warna hitam doff berapa? sekalian nanya kalau poles vario 150 glossy kena berapa ya?")
    assert_semantic(reply1, "Bot MUST ONLY answer the price for the Nmax Repaint. Bot MUST explicitly state that it will focus on discussing the Nmax first before moving on to the Vario.")

if __name__ == "__main__":
    # If run locally
    test_scenario_a_repaint_bodi_halus_upsell()
    test_scenario_b_repaint_velg_constraint()
    test_scenario_c_objection_handling()
    test_scenario_d_anti_coating_on_repaint()
    test_scenario_e_multi_motor_focus()
    print("All tests passed!")
