import streamlit as st
import pandas as pd
import google.generativeai as genai
from PIL import Image
import json
import io

# --- 網頁初始設定 ---
st.set_page_config(page_title="布匹連續掃描入庫系統", page_icon="📦", layout="wide")
st.title("📦 紡織布匹 AI 連續掃描入庫系統")
st.markdown("支援連續拍照，自動辨識**幅寬、碼重、數量(公斤/碼)**，可直接在表格內修改資料並匯出 Excel。")

if "inventory_data" not in st.session_state:
    st.session_state.inventory_data =[]

with st.sidebar:
    st.header("⚙️ 系統設定")
    api_key = st.text_input("請輸入 Google Gemini API Key:", type="password")
    st.caption("設定完畢後即可開始拍照/上傳標籤")
    if st.button("🗑️ 清空目前所有清單"):
        st.session_state.inventory_data =[]
        st.rerun()

if api_key:
    genai.configure(api_key=api_key)
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.info("📱 提示：手機瀏覽器點擊下方按鈕，可直接選擇【拍照】或相簿")
        uploaded_file = st.file_uploader("上傳或拍攝布匹標籤", type=["jpg", "jpeg", "png"])
        
    with col2:
        if uploaded_file:
            img = Image.open(uploaded_file)
            st.image(img, caption="🔍 點擊圖片可放大核對", use_container_width=True)

    if uploaded_file and st.button("🚀 辨識並加入清單", use_container_width=True):
        with st.spinner("AI 正在讀取標籤，請稍候..."):
            try:
                model = genai.GenerativeModel('gemini-1.5-flash', generation_config={"response_mime_type": "application/json"})
                prompt = """
                你是一個專業的紡織廠倉管人員。請仔細辨識這張布料標籤照片，提取以下欄位：
                1. 編號 (如批號、缸號、Roll No)
                2. 幅寬 (Width)
                3. 碼重 (Yard Weight)
                4. 數量 (僅填寫數字)
                5. 單位 (仔細判斷數量是重量還是長度。若是重量填"公斤"，若是長度填"碼"，請統一輸出這兩個詞)
                6. 庫存 (若標籤有寫儲位填寫儲位，無則填寫 "在庫")

                請務必只回傳 JSON 格式。找不到請填入 "未標示"。
                範例：{"編號": "A-12345", "幅寬": "60", "碼重": "320", "數量": "25.5", "單位": "公斤", "庫存": "在庫"}
                """
                response = model.generate_content([prompt, img])
                data = json.loads(response.text)
                st.session_state.inventory_data.append(data)
                st.success(f"✅ 編號 {data.get('編號', '未知')} 已成功加入清單！")
            except Exception as e:
                st.error(f"發生錯誤：{e}")

st.divider()
st.subheader("📋 目前累積的盤點清單 (可直接點擊表格修改內容)")

if len(st.session_state.inventory_data) > 0:
    df = pd.DataFrame(st.session_state.inventory_data)
    edited_df = st.data_editor(df, num_rows="dynamic", use_container_width=True)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        edited_df.to_excel(writer, index=False, sheet_name='入庫清單')
    excel_data = output.getvalue()

    st.download_button(
        label="📥 下載完整 Excel 入庫檔",
        data=excel_data,
        file_name="布匹連續入庫清單.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        type="primary"
    )
else:
    st.info("目前清單為空，請從上方上傳照片開始辨識。")
