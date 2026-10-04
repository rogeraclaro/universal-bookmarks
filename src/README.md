<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1E9NYnblfrQW0f7M3i25c7pD3wN6L5K9I

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `VITE_STORAGE_SECRET` in [.env.local](.env.local) to the backend's `API_SECRET` (AI calls go through the backend, which uses DeepSeek via `DEEPSEEK_API_KEY` in the server's `.env`; never put the DeepSeek key in a `VITE_*` variable)
3. Run the app:
   `npm run dev`
