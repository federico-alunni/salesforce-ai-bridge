# Getting Your Free OpenRouter API Key

OpenRouter provides access to many AI models, including completely **FREE** models like DeepSeek R1T2 Chimera.

## Step 1: Sign Up

1. Go to [openrouter.ai](https://openrouter.ai)
2. Click **"Sign In"** in the top right
3. Sign up with:
   - Google account
   - GitHub account
   - Or email

## Step 2: Get API Key

1. After signing in, go to [Keys](https://openrouter.ai/keys)
2. Click **"Create Key"**
3. Give it a name (e.g., "Salesforce AI Bridge")
4. Click **"Create"**
5. **Copy the key** - it starts with `sk-or-v1-...`

⚠️ **Important**: Save this key immediately! You won't be able to see it again.

## Step 3: Add to Your Project

1. Open your `.env` file
2. Add the key:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-your-actual-key-here
   ```

## Free Models Available

OpenRouter offers several **completely free** models perfect for development:

### Recommended: DeepSeek R1T2 Chimera (Default)

```env
OPENROUTER_MODEL=nousresearch/deepseek-r1t2-chimera:free
```

- **Cost**: FREE
- **Features**: Function calling support
- **Best for**: Development and testing

### Other Free Options:

```env
# Google Gemini Flash (Free tier)
OPENROUTER_MODEL=google/gemini-flash-1.5

# Meta Llama 3.1 8B (Free)
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free

# Mistral 7B (Free)
OPENROUTER_MODEL=mistralai/mistral-7b-instruct:free
```

## Rate Limits (Free Tier)

- **No credit card required**
- **Generous rate limits** for development
- **Free credits** for new users ($1-5 typically)
- **Free models** have no cost per token

## Upgrading for Production

When ready for production, you can:

1. Add credits to your account (pay-as-you-go)
2. Use more powerful models:
   - `anthropic/claude-3.5-sonnet`
   - `openai/gpt-4-turbo`
   - `google/gemini-pro-1.5`

## Checking Usage

1. Go to [Activity](https://openrouter.ai/activity)
2. View your API usage and costs
3. Monitor rate limits

## API Key Security

✅ **DO:**

- Store API key in `.env` file
- Add `.env` to `.gitignore`
- Use environment variables

❌ **DON'T:**

- Commit API keys to git
- Share keys publicly
- Hardcode keys in source code

## Troubleshooting

### "Invalid API key"

- Double-check the key in your `.env` file
- Ensure it starts with `sk-or-v1-`
- No extra spaces or quotes

### "Rate limit exceeded"

- Wait a few seconds and try again
- Consider adding credits for higher limits
- Use free models during development

### "Model not found"

- Check the model name matches exactly
- See [available models](https://openrouter.ai/docs#models)
- Verify the model supports function calling

## Benefits of OpenRouter

✅ **One API for many models** - Easy to switch providers  
✅ **Free tier available** - No credit card required  
✅ **Pay-as-you-go** - Only pay for what you use  
✅ **Function calling** - Tool use support  
✅ **Good for development** - Free models work well

## Next Steps

Once you have your API key:

1. ✅ Add it to `.env`
2. ✅ Run `npm install`
3. ✅ Start the server: `npm run dev`
4. ✅ Test it: `curl http://localhost:3001/health`

---

**Need help?** Check the [OpenRouter Documentation](https://openrouter.ai/docs)
