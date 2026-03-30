import os
import json
import cloudinary
import cloudinary.uploader
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify
from PIL import Image

app = Flask(__name__)

# 從 Zeabur 環境變數讀取
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "1234")
CLOUDINARY_URL = os.getenv("CLOUDINARY_URL")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if CLOUDINARY_URL:
    cloudinary.config(cloudinary_url=CLOUDINARY_URL)

db_data = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/data')
def get_data():
    return jsonify(db_data)

@app.route('/analyze', methods=['POST'])
def analyze():
    password = request.form.get('password')
    image_file = request.files.get('image')
    if password != ADMIN_PASSWORD:
        return jsonify({"error": "管理員密碼錯誤"}), 403
    try:
        # 上傳照片
        upload_result = cloudinary.uploader.upload(image_file)
        img_url = upload_result['secure_url']
        # AI 辨識
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash')
        image_file.seek(0)
        img = Image.open(image_file.stream)
        prompt = "分析這張紡織色卡，輸出JSON: [{\"category\": \"缸號\", \"color\": \"顏色\", \"width\": 數字, \"gsm\": 數字, \"amount\": 數字, \"unit\": \"kg/Y\", \"fabric_type\": \"針織/平織\"}]"
        response = model.generate_content([prompt, img])
        json_text = response.text.replace('```json', '').replace('```', '').strip()
        items = json.loads(json_text)
        # 換算
        for item in items:
            factor = (float(item['width']) * 0.02322 * float(item['gsm'])) / 1000
            if item['unit'].lower() in ['k', 'kg']:
                item['kg'] = item['amount']
                item['yards'] = round(item['amount'] / factor, 1) if factor > 0 else 0
            else:
                item['yards'] = item['amount']
                item['kg'] = round(item['amount'] * factor, 2)
            item['img_url'] = img_url
            db_data.insert(0, item)
        return jsonify(items)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # 重要：Zeabur 必須監聽 0.0.0.0 且讀取 PORT
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)