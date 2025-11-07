# Hosting Your Own Consumet API

This guide explains how to host your own Consumet API instance so you can make your anime dashboard public.

## What is Consumet?

Consumet is an open-source API that provides anime streaming links and metadata. It aggregates data from various anime streaming sites (like HiAnime, GogoAnime, AnimePahe, etc.) and provides a unified API interface.

**Why host your own?**
- The public Consumet API is no longer available
- You need control over rate limits and availability
- You want to ensure your dashboard works reliably
- You can customize and maintain it yourself

---

## Quick Start (Docker - Easiest)

The easiest way to run Consumet is using Docker:

```bash
# Pull the Docker image
docker pull riimuru/consumet-api

# Run the container
docker run -d -p 3002:3000 --name consumet-api riimuru/consumet-api
```

This will:
- Start Consumet API on port 3002 (mapped from container's port 3000)
- Run in the background (`-d` flag)
- Be accessible at `http://localhost:3002`

**For production**, you'll want to:
1. Use a reverse proxy (nginx, Caddy, etc.)
2. Set up SSL/TLS certificates
3. Configure environment variables
4. Set up auto-restart on failure

---

## Manual Setup (From Source)

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **Git**

### Step 1: Clone the Repository

```bash
git clone https://github.com/consumet/api.consumet.org.git
cd api.consumet.org
```

### Step 2: Install Dependencies

```bash
npm install
# or
yarn install
```

### Step 3: Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Production mode
NODE_ENV=production

# Server port (default: 3000)
PORT=3002

# Optional: Redis for caching (if you want better performance)
REDIS_URL=redis://localhost:6379

# Optional: Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Step 4: Start the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

The API will be available at `http://localhost:3002` (or whatever port you configured).

---

## Deployment Options

### 🆓 Free Tier Comparison

Here's a detailed comparison of the best **free tier** options (based on [Cloud-Free-Tier-Comparison](https://github.com/cloudcommunity/Cloud-Free-Tier-Comparison)):

| Platform | Free Tier Limits | Best For | Rating |
|----------|-----------------|----------|--------|
| **Oracle Cloud** | 2 VMs (1/8 OCPU, 1GB RAM each), 10TB egress | Always-on VMs, production | ⭐⭐⭐⭐⭐ |
| **Railway** | 500 hours/month, $5 credit | Personal projects, testing | ⭐⭐⭐⭐⭐ |
| **Cyclic.sh** | Unlimited requests, 1GB RAM | High-traffic APIs | ⭐⭐⭐⭐⭐ |
| **Render** | 750 hours/month, spins down after 15min | Low-traffic APIs | ⭐⭐⭐⭐ |
| **Fly.io** | 3 shared VMs, 3GB storage | Always-on services | ⭐⭐⭐⭐ |
| **Google Cloud** | 0.25 vCPU, 1GB RAM, 30GB disk | Always-on VMs | ⭐⭐⭐⭐ |
| **AWS** | Lambda: 1M requests/month | Serverless APIs | ⭐⭐⭐ |
| **Vercel** | Serverless functions, 100GB bandwidth | Serverless APIs | ⭐⭐⭐ |
| **Netlify** | Serverless functions, 300 build min/month | Serverless APIs | ⭐⭐⭐ |
| **Zeabur** | 10GB outbound/month, $5 usage credit | Serverless/static | ⭐⭐⭐ |
| **Cloudflare** | Workers (serverless), 10GB R2 storage | Serverless APIs | ⭐⭐⭐ |

**🏆 Best Overall Free Tier: Oracle Cloud or Railway**

**Quick Recommendations:**

- **🥇 Best Always-Free VMs: Oracle Cloud** ⭐ NEW
  - **2 VMs** (1/8 OCPU, 1GB RAM each) - always free!
  - **10TB network egress/month** (most generous!)
  - **200GB block storage**
  - **No spin-down, always-on**
  - **Best for production use**
  - Requires credit card (but free tier is truly free)

- **🥇 Best for Most Users: Railway**
  - Easiest setup, good balance of features
  - 500 hours/month is plenty for personal use
  - No credit card required
  - Wakes up quickly after inactivity

- **🥇 Best for High Traffic: Cyclic.sh**
  - **Unlimited requests** (no rate limits!)
  - Always-on (no spin-down)
  - Built on AWS (reliable)
  - Best for production use

- **🥈 Good Alternative: Render**
  - Most hours (750/month)
  - But spins down after 15min (slow first request)
  - Good for low-traffic APIs

- **🥈 Always-On Option: Google Cloud**
  - 0.25 vCPU, 1GB RAM, 30GB disk
  - Always-on (no spin-down)
  - Requires credit card (but free tier is free)

- **🥉 Always-On Option: Fly.io**
  - 3 always-on VMs
  - No spin-down
  - Requires credit card (but free tier is free)

---

### Option 1: Railway (⭐ Recommended for Free Tier)

**Free Tier:**
- ✅ 500 hours/month (~20 days of 24/7 uptime)
- ✅ $5 credit per month
- ✅ 512 MB RAM, shared CPU
- ✅ 1 GB disk space
- ✅ Automatic HTTPS
- ✅ GitHub integration
- ✅ No credit card required

**Limitations:**
- ⚠️ Spins down after inactivity (wakes on first request)
- ⚠️ Limited to 500 hours/month (may need to upgrade for 24/7)

**Setup:**
1. Go to [Railway](https://railway.app/)
2. Click "New Project" → "Deploy from GitHub"
3. Connect your GitHub account
4. Select the `consumet/api.consumet.org` repository
5. Railway will automatically deploy it
6. Set the port to `3000` in Railway settings
7. Railway will provide a public URL (e.g., `https://consumet-api.up.railway.app`)

**Best for:** Personal projects, testing, low-to-medium traffic

---

### Option 2: Cyclic.sh (⭐ Best for High Traffic)

**Free Tier:**
- ✅ **Unlimited requests** (no rate limits!)
- ✅ 1 GB RAM
- ✅ 512 MB temporary storage
- ✅ 1 GB object storage
- ✅ 1 GB database storage
- ✅ Always-on (no spin-down)
- ✅ Automatic HTTPS
- ✅ GitHub integration
- ✅ Built on AWS infrastructure

**Limitations:**
- ⚠️ 1 GB RAM may be limiting for heavy workloads
- ⚠️ Limited storage

**Setup:**
1. Go to [Cyclic.sh](https://www.cyclic.sh/)
2. Click "Start Building" → "Deploy from GitHub"
3. Connect your GitHub account
4. Select the `consumet/api.consumet.org` repository
5. Cyclic will automatically deploy it
6. Cyclic will provide a public URL (e.g., `https://consumet-api.cyclic.app`)

**Best for:** High-traffic APIs, always-on services, production use

---

### Option 3: Render

**Free Tier:**
- ✅ 750 hours/month (~31 days of 24/7 uptime)
- ✅ 512 MB RAM, shared CPU
- ✅ Automatic HTTPS
- ✅ GitHub integration
- ✅ No credit card required

**Limitations:**
- ⚠️ **Spins down after 15 minutes of inactivity** (cold starts take ~30-60 seconds)
- ⚠️ First request after spin-down is slow

**Setup:**
1. Go to [Render](https://render.com/)
2. Click "New" → "Web Service"
3. Connect your GitHub account
4. Select the `consumet/api.consumet.org` repository
5. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `Node`
6. Click "Create Web Service"
7. Render will provide a public URL (e.g., `https://consumet-api.onrender.com`)

**Best for:** Low-traffic APIs, development/testing

**⚠️ Important:** The spin-down behavior means the first request after inactivity will be slow. For production, consider upgrading to a paid plan or using Railway/Cyclic.

---

### Option 4: Fly.io

**Free Tier:**
- ✅ 3 shared VMs (always-on)
- ✅ 3 GB storage per VM
- ✅ 160 GB outbound data transfer/month
- ✅ Automatic HTTPS
- ✅ Global edge network
- ✅ No spin-down

**Limitations:**
- ⚠️ Shared CPU (may be slower)
- ⚠️ Limited to 3 VMs
- ⚠️ Requires credit card (but won't charge on free tier)

**Setup:**
1. Install Fly CLI: `npm install -g @fly/cli`
2. Login: `fly auth login`
3. Clone and deploy:
   ```bash
   git clone https://github.com/consumet/api.consumet.org.git
   cd api.consumet.org
   fly launch
   ```
4. Follow the prompts
5. Fly.io will provide a public URL

**Best for:** Always-on services, global distribution

---

### Option 5: Vercel (Serverless)

**Free Tier:**
- ✅ 100 GB bandwidth/month
- ✅ Serverless functions (10s timeout)
- ✅ Automatic HTTPS
- ✅ GitHub integration
- ✅ Global CDN

**Limitations:**
- ⚠️ 10-second function timeout (may not work for long-running requests)
- ⚠️ Serverless architecture (may need code changes)
- ⚠️ Cold starts

**Best for:** Serverless APIs, edge functions

**Note:** Consumet API may need modifications to work with Vercel's serverless model.

---

### Option 6: Netlify (Serverless)

**Free Tier:**
- ✅ 300 build minutes/month
- ✅ Serverless functions (10s timeout)
- ✅ 100 GB bandwidth/month
- ✅ Automatic HTTPS
- ✅ GitHub integration

**Limitations:**
- ⚠️ 10-second function timeout
- ⚠️ Serverless architecture (may need code changes)
- ⚠️ Cold starts

**Best for:** Serverless APIs, edge functions

**Note:** Consumet API may need modifications to work with Netlify's serverless model.

---

### Option 12: Docker on a VPS (Paid, but Cheap)

**Not free, but very affordable (with free credits):**

1. **Get a VPS** (DigitalOcean, Linode, Vultr, Hetzner, etc.)
   - **DigitalOcean**: $4/month (512MB RAM, 1 CPU) - [Free $100 credit for 60 days](https://www.digitalocean.com/)
   - **Linode**: $5/month (1GB RAM, 1 CPU) - [Free $100 credit for 60 days](https://www.linode.com/)
   - **Vultr**: $2.50/month (512MB RAM, 1 CPU)
   - **Hetzner**: €4.15/month (2GB RAM, 1 CPU) - Best value in Europe

2. **Install Docker** on your VPS:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```

3. **Run Consumet**:
   ```bash
   docker run -d \
     --name consumet-api \
     --restart unless-stopped \
     -p 3002:3000 \
     riimuru/consumet-api
   ```

4. **Set up Nginx reverse proxy** (for SSL and domain):
   ```nginx
   server {
       listen 80;
       server_name consumet.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3002;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

5. **Set up SSL** with Let's Encrypt:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d consumet.yourdomain.com
   ```

**Best for:** Production use, full control, always-on

---

### Option 7: Oracle Cloud (⭐ Best Always-Free VMs)

**Free Tier:**
- ✅ **2 AMD-based VMs**: 1/8 OCPU (0.25 vCPU), 1GB RAM each
- ✅ **10TB network egress/month** (most generous free tier!)
- ✅ **200GB block storage** (2 volumes, 100GB each)
- ✅ **10GB object storage**
- ✅ **Always-on** (no spin-down)
- ✅ **No time limits** (truly always free)
- ✅ **Automatic HTTPS** (via Load Balancer)

**Limitations:**
- ⚠️ Requires credit card (but free tier is truly free - won't charge)
- ⚠️ Limited to specific regions (us-ashburn-1, us-phoenix-1, etc.)
- ⚠️ More complex setup than Railway/Render

**Setup:**

#### Option A: Build from Your Local Source (Recommended)

1. **Go to [Oracle Cloud](https://www.oracle.com/cloud/free/)**
2. **Sign up for free tier** (requires credit card, but won't charge)
3. **Create a VM instance:**
   - **Shape**: VM.Standard.E2.1.Micro (Always Free Eligible)
   - **OS**: Ubuntu 22.04 (recommended) or Oracle Linux
   - **SSH Key**: Generate and add your public key
   - **Networking**: Allow HTTP/HTTPS traffic

4. **SSH into your VM:**
   ```bash
   ssh opc@your-vm-ip
   # or for Ubuntu
   ssh ubuntu@your-vm-ip
   ```

5. **Install Docker and Git:**
   ```bash
   # For Ubuntu
   sudo apt update
   sudo apt install -y docker.io git
   sudo systemctl start docker
   sudo systemctl enable docker
   sudo usermod -aG docker $USER
   # Log out and back in for group changes to take effect
   
   # For Oracle Linux
   sudo yum install -y docker git
   sudo systemctl start docker
   sudo systemctl enable docker
   sudo usermod -aG docker opc
   ```

6. **Upload your Consumet API source code:**
   
   **Option 1: Using Git (if your code is in a repository):**
   ```bash
   git clone https://github.com/consumet/api.consumet.org.git
   cd api.consumet.org
   ```
   
   **Option 2: Using SCP from your local machine:**
   ```bash
   # From your local Windows machine (PowerShell)
   scp -r C:\Users\tyler\Documents\Projects\anime\consumet-api\consumet-api opc@your-vm-ip:~/
   ```
   
   **Option 3: Using rsync (if available):**
   ```bash
   # From your local machine
   rsync -avz C:\Users\tyler\Documents\Projects\anime\consumet-api\consumet-api opc@your-vm-ip:~/
   ```

7. **Build and run the Docker container:**
   ```bash
   cd ~/consumet-api  # or wherever you uploaded it
   
   # Build the Docker image
   docker build -t consumet-api .
   
   # Run the container
   docker run -d \
     --name consumet-api \
     --restart unless-stopped \
     -p 3000:3000 \
     -e PORT=3000 \
     -e NODE_ENV=PROD \
     consumet-api
   ```

8. **Verify it's running:**
   ```bash
   docker ps
   docker logs consumet-api
   
   # Test the API
   curl http://localhost:3000
   ```

9. **Configure firewall:**
   ```bash
   # For Ubuntu (ufw)
   sudo ufw allow 3000/tcp
   sudo ufw enable
   
   # For Oracle Linux (firewalld)
   sudo firewall-cmd --permanent --add-port=3000/tcp
   sudo firewall-cmd --reload
   ```

10. **Set up domain and SSL (optional):**
    - Use Oracle Cloud Load Balancer (free tier eligible)
    - Or use Cloudflare for free SSL
    - Or use Nginx as reverse proxy with Let's Encrypt

#### Option B: Use Pre-built Docker Image

If you prefer to use the pre-built image instead:

```bash
# Pull and run the pre-built image
docker run -d \
  --name consumet-api \
  --restart unless-stopped \
  -p 3000:3000 \
  -e PORT=3000 \
  riimuru/consumet-api
```

**Note:** The pre-built image may not have your latest changes. Building from source ensures you have the exact version you want.

**Best for:** Production use, always-on services, high-traffic APIs

**Important Notes:**

- **Port Configuration**: The Consumet API defaults to port 3002, but the Dockerfile exposes port 3000. Make sure to set `PORT=3000` environment variable when running the container, or update the Dockerfile to use port 3002.

- **Memory Requirements**: The free tier VM has 1GB RAM, which should be sufficient for Consumet API. If you experience memory issues, consider:
  - Using Node.js memory limits: `-e NODE_OPTIONS="--max-old-space-size=512"`
  - Or upgrading to a paid tier

- **Build Time**: Building the Docker image on the free tier VM may take 5-10 minutes due to limited CPU resources. Be patient!

- **Oracle Cloud has one of the most generous free tiers available**. The 10TB egress/month is unmatched by other providers. See [Cloud-Free-Tier-Comparison](https://github.com/cloudcommunity/Cloud-Free-Tier-Comparison) for details.

---

### Option 8: Google Cloud (Always-Free VMs)

**Free Tier:**
- ✅ **0.25 vCPU, 1GB RAM** (f1-micro instance)
- ✅ **30GB standard persistent disk**
- ✅ **1GB network egress** (premium tier)
- ✅ **200GB network egress** (standard tier, with increased latency)
- ✅ **Always-on** (no spin-down)
- ✅ **No time limits** (always free)

**Limitations:**
- ⚠️ Requires credit card (but free tier is free)
- ⚠️ Limited to us-west1, us-central1, us-east1 regions
- ⚠️ More complex setup than Railway/Render

**Setup:**
1. Go to [Google Cloud](https://cloud.google.com/free)
2. Sign up for free tier (requires credit card, but won't charge)
3. Create a VM instance:
   - **Machine type**: f1-micro (always free)
   - **Region**: us-west1, us-central1, or us-east1
   - **OS**: Ubuntu 22.04
   - **Firewall**: Allow HTTP/HTTPS traffic
4. SSH into your VM (via Google Cloud Console)
5. Install Docker:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```
6. Run Consumet:
   ```bash
   docker run -d \
     --name consumet-api \
     --restart unless-stopped \
     -p 3000:3000 \
     riimuru/consumet-api
   ```
7. Set up domain and SSL (optional):
   - Use Google Cloud Load Balancer
   - Or use Cloudflare for free SSL

**Best for:** Production use, always-on services

**Note:** See [Cloud-Free-Tier-Comparison](https://github.com/cloudcommunity/Cloud-Free-Tier-Comparison) for full details.

---

### Option 9: AWS (Serverless with Lambda)

**Free Tier:**
- ✅ **AWS Lambda**: 1 million requests/month
- ✅ **400,000 GB-seconds** compute time
- ✅ **Always free** (no time limits)

**Limitations:**
- ⚠️ Serverless architecture (may need code modifications)
- ⚠️ 15-minute function timeout
- ⚠️ Cold starts
- ⚠️ More complex setup

**Best for:** Serverless APIs, low-traffic use

**Note:** Consumet API may need modifications to work with Lambda's serverless model. See [Cloud-Free-Tier-Comparison](https://github.com/cloudcommunity/Cloud-Free-Tier-Comparison) for details.

---

### Option 10: Cloudflare Workers (Serverless)

**Free Tier:**
- ✅ **100,000 requests/day**
- ✅ **10GB R2 storage** (S3-compatible)
- ✅ **Global edge network**
- ✅ **Always free**

**Limitations:**
- ⚠️ Serverless architecture (may need code modifications)
- ⚠️ 10ms CPU time limit (free tier)
- ⚠️ Cold starts

**Best for:** Serverless APIs, edge functions

**Note:** Consumet API may need modifications to work with Cloudflare Workers. See [Cloud-Free-Tier-Comparison](https://github.com/cloudcommunity/Cloud-Free-Tier-Comparison) for details.

---

### Option 11: Zeabur

**Free Tier:**
- ✅ **10GB outbound data transfer/month**
- ✅ **$5 usage credit/month** (developer plan)
- ✅ **Serverless functions and static sites**
- ✅ **GitHub integration**

**Limitations:**
- ⚠️ Limited to 10GB/month
- ⚠️ May need code modifications for serverless

**Best for:** Serverless APIs, static sites

**Note:** See [Cloud-Free-Tier-Comparison](https://github.com/cloudcommunity/Cloud-Free-Tier-Comparison) for details.

---

## Configure Your Anime Dashboard

Once your Consumet API is running and publicly accessible, update your dashboard's `.env` file:

```env
# Your Consumet API URL (replace with your actual URL)
CONSUMET_API_URL=https://consumet.yourdomain.com
# or
CONSUMET_API_URL=https://consumet-api.up.railway.app
# or
CONSUMET_API_URL=https://consumet-api.onrender.com
```

**Important**: Make sure your Consumet API URL:
- ✅ Is publicly accessible (not `localhost`)
- ✅ Uses HTTPS (for production)
- ✅ Doesn't require authentication (unless you've added it)
- ✅ Is accessible from your dashboard's server

---

## Testing Your Consumet API

Test that your API is working:

```bash
# Test search endpoint
curl "https://your-consumet-api.com/anime/zoro/one%20piece"

# Should return JSON with anime results
```

Or visit in your browser:
```
https://your-consumet-api.com/anime/zoro/one%20piece
```

---

## API Endpoints

Your Consumet API will provide these endpoints (used by your dashboard):

### Search Anime
```
GET /anime/{provider}/{query}
```

**Providers:**
- `zoro` - HiAnime links
- `animepahe` - AnimePahe links
- `gogoanime` - GogoAnime links

**Example:**
```
GET /anime/zoro/one%20piece
GET /anime/animepahe/demon%20slayer
GET /anime/gogoanime/naruto
```

**Response:**
```json
{
  "results": [
    {
      "id": "...",
      "title": "...",
      "url": "https://hianime.to/...",
      ...
    }
  ]
}
```

---

## Performance & Optimization

### Caching

Consumet API responses are cached in your dashboard (7 days by default). This reduces API calls and improves performance.

### Rate Limiting

If you're hosting your own Consumet API, you can:
- Configure rate limiting in Consumet's `.env`
- Add Redis caching for better performance
- Monitor usage and adjust limits

### Monitoring

Monitor your Consumet API:
- **Uptime**: Use UptimeRobot or similar
- **Logs**: Check Docker logs: `docker logs consumet-api`
- **Performance**: Monitor response times and errors

---

## Troubleshooting

### API Not Responding

1. **Check if it's running:**
   ```bash
   # Docker
   docker ps | grep consumet
   
   # Manual
   curl http://localhost:3002/health
   ```

2. **Check logs:**
   ```bash
   # Docker
   docker logs consumet-api
   
   # Manual
   # Check console output
   ```

3. **Check firewall:**
   - Ensure port 3002 (or your port) is open
   - Check VPS firewall rules

### CORS Issues

If you get CORS errors, you may need to configure CORS in Consumet:

```javascript
// In Consumet's server code
app.use(cors({
  origin: ['https://your-dashboard.com'],
  credentials: true
}));
```

### Rate Limiting

If you hit rate limits:
- Increase rate limit settings in Consumet's `.env`
- Add Redis caching
- Reduce concurrent requests from your dashboard

---

## Security Considerations

1. **Don't expose sensitive data** - Consumet API doesn't need authentication by default, but you can add it if needed

2. **Use HTTPS** - Always use SSL/TLS in production

3. **Rate limiting** - Configure rate limits to prevent abuse

4. **Monitor usage** - Keep an eye on API usage and block suspicious activity

5. **Keep updated** - Regularly update Consumet to get bug fixes and improvements

---

## Cost Estimates

**Free Options:**
- Railway: Free tier (500 hours/month)
- Render: Free tier (750 hours/month)
- Fly.io: Free tier (3 shared VMs)

**Paid Options:**
- VPS: $5-10/month (DigitalOcean, Linode, Vultr)
- Railway: $5/month (hobby plan)
- Render: $7/month (starter plan)

---

## Alternative: Skip Consumet

If you don't want to host Consumet, your dashboard will still work! It will:
- Use fallback search URLs (generated from anime titles)
- Use Jikan API for official streaming links
- Work without Consumet, just with less accurate direct links

To disable Consumet, simply don't set `CONSUMET_API_URL` in your `.env` file, or set it to an empty string.

---

## Resources

- **Consumet GitHub**: https://github.com/consumet/api.consumet.org
- **Consumet Documentation**: Check the repository's README
- **Docker Hub**: https://hub.docker.com/r/riimuru/consumet-api

---

## Next Steps

1. ✅ Choose a deployment option
2. ✅ Deploy Consumet API
3. ✅ Test the API endpoints
4. ✅ Update your dashboard's `.env` with the Consumet URL
5. ✅ Test streaming links in your dashboard
6. ✅ Monitor and maintain your API

Happy hosting! 🚀

