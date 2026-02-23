---
marp: true
theme: default
paginate: true
size: 16:9
style: |
  section {
    font-family: 'Noto Sans JP', 'Helvetica Neue', Arial, sans-serif;
    font-size: 24px;
  }
  h1 {
    font-size: 48px;
    color: #1a1a2e;
  }
  h2 {
    font-size: 36px;
    color: #16213e;
  }
  .columns {
    display: grid;
    grid-template-columns: 58% 42%;
    gap: 20px;
  }
  .left-column {
    padding-right: 10px;
  }
  .right-column {
    padding-left: 10px;
    background: #f5f5f5;
    border-radius: 8px;
    padding: 20px;
  }
---

# MD2slide PoC 検証

Marp CLI → Google Slides 変換品質テスト

---

# P1: 2カラムテンプレート

<div class="columns">
<div class="left-column">

## 左カラム（58%）

- 見出しと本文
- 箇条書きリスト
- 要点をまとめる

### サブ見出し

テキストコンテンツをここに配置

</div>
<div class="right-column">

## 右カラム（42%）

カード形式で補足情報を表示

- ポイント1
- ポイント2
- ポイント3

</div>
</div>

---

# P2: 図解テンプレート - 3ボックス横並び

<div style="display: flex; gap: 20px; margin-top: 30px;">
<div style="flex: 1; background: #e3f2fd; padding: 20px; border-radius: 8px; text-align: center;">

### Human

人間の入力と判断

</div>
<div style="flex: 1; background: #fff3e0; padding: 20px; border-radius: 8px; text-align: center;">

### AI

AIによる処理

</div>
<div style="flex: 1; background: #e8f5e9; padding: 20px; border-radius: 8px; text-align: center;">

### Output

最終成果物

</div>
</div>

---

# P2: 図解テンプレート - 縦フロー

<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">

<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3;">
<strong>Step 1:</strong> 要件定義
</div>

<div style="text-align: center; font-size: 24px;">↓</div>

<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; border-left: 4px solid #4caf50;">
<strong>Step 2:</strong> 設計・実装
</div>

<div style="text-align: center; font-size: 24px;">↓</div>

<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9800;">
<strong>Step 3:</strong> テスト・検証
</div>

<div style="text-align: center; font-size: 24px;">↓</div>

<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; border-left: 4px solid #9c27b0;">
<strong>Step 4:</strong> リリース
</div>

</div>

---

# P2: 図解テンプレート - Before/After

<div style="display: flex; gap: 40px; margin-top: 30px; align-items: center;">

<div style="flex: 1; background: #ffebee; padding: 20px; border-radius: 8px; text-align: center;">

### Before

従来の手法

- 手動作業
- 時間がかかる
- エラーが多い

</div>

<div style="font-size: 48px; color: #4caf50;">
→
</div>

<div style="flex: 1; background: #e8f5e9; padding: 20px; border-radius: 8px; text-align: center;">

### After

新しいアプローチ

- 自動化
- 高速処理
- 高精度

</div>

</div>

---

# P3: ラベル・バッジ

<div style="margin-top: 30px;">

## テキストラベル

<span style="background: #e3f2fd; padding: 4px 12px; border-radius: 4px; color: #1565c0;">情報</span>
<span style="background: #fff3e0; padding: 4px 12px; border-radius: 4px; color: #e65100;">警告</span>
<span style="background: #e8f5e9; padding: 4px 12px; border-radius: 4px; color: #2e7d32;">成功</span>

## 角丸バッジ

<span style="background: #2196f3; padding: 6px 16px; border-radius: 20px; color: white;">NEW</span>
<span style="background: #4caf50; padding: 6px 16px; border-radius: 20px; color: white;">v1.0</span>
<span style="background: #ff9800; padding: 6px 16px; border-radius: 20px; color: white;">β版</span>

</div>

---

# まとめ

- P1: 2カラム（左58%/右42%）
- P2: 図解3種（3ボックス、縦フロー、Before/After）
- P3: ラベル/バッジ

以上のテンプレートがGoogle Slidesで正しく表示されるか検証
