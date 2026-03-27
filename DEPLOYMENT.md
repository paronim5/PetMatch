# Deployment Guide for paroniim.xyz

This guide documents the steps to configure and deploy the application on an AWS EC2 instance with the domain `paroniim.xyz` and IP `23.21.34.9`.

## 1. DNS Configuration

You need to point your domain to the AWS server's IP address.

1.  Log in to your domain registrar's control panel (e.g., Namecheap, GoDaddy, Route53).
2.  Navigate to the **DNS Management** or **Advanced DNS** section for `paroniim.xyz`.
3.  Add the following **A Records**:

| Type | Host | Value | TTL |
| :--- | :--- | :--- | :--- |
| A | @ | 23.21.34.9 | Automatic / 30 min |
| A | www | 23.21.34.9 | Automatic / 30 min |

*Note: It may take up to 24-48 hours for DNS changes to propagate globally, but it often happens much faster.*

## 2. AWS Security Group Configuration

Ensure your EC2 instance allows web traffic.

1.  Log in to the **AWS Management Console**.
2.  Go to **EC2** > **Instances**.
3.  Select your instance.
4.  Click on the **Security** tab and then click the **Security Group** ID.
5.  Edit **Inbound rules** and ensure the following rules exist:

| Type | Protocol | Port Range | Source | Description |
| :--- | :--- | :--- | :--- | :--- |
| HTTP | TCP | 80 | 0.0.0.0/0 | Allow HTTP access |
| HTTPS | TCP | 443 | 0.0.0.0/0 | Allow HTTPS access |
| SSH | TCP | 22 | Your IP | Allow SSH access (optional but recommended) |

## 3. Server Setup & Deployment

### Prerequisites
Ensure Docker and Docker Compose are installed on your server.

> **t3.micro (1 GB RAM) — add swap space first.**
> Even with the optimized build, the app needs a little extra headroom during startup.
> Run these commands once on the EC2 instance before deploying:
> ```bash
> sudo fallocate -l 1G /swapfile
> sudo chmod 600 /swapfile
> sudo mkswap /swapfile
> sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

### Configuration Steps

1.  **Clone/Copy the project** to your server.
2.  **Update Email for SSL**:
    *   Open `init-letsencrypt.sh` and update the `email` variable (line 15) to your valid email address. This is used by Let's Encrypt for renewal notifications.
    ```bash
    email="your-email@example.com"
    ```
3.  **Make the script executable**:
    ```bash
    chmod +x init-letsencrypt.sh
    ```
4.  **Run the Initialization Script**:
    This script will:
    *   Download necessary TLS parameters.
    *   Generate a dummy certificate to start Nginx.
    *   Request a real Let's Encrypt certificate for `paroniim.xyz` and `www.paroniim.xyz`.
    *   Reload Nginx to use the new certificate.

    ```bash
    ./init-letsencrypt.sh
    ```

    *   Follow the prompts (Type `y` if asked).
    *   Wait for the "Requesting Let's Encrypt certificate..." step to complete successfully.

5.  **Verify the Containers**:
    Check if all services are running:
    ```bash
    docker-compose ps
    ```
    You should see `nginx`, `backend`, `frontend`, `db`, etc., in the `Up` state.

## 4. Verification

1.  **Domain Access**:
    *   Open your browser and visit `http://paroniim.xyz`.
    *   It should automatically redirect to `https://paroniim.xyz`.
    *   You should see the secure lock icon in the address bar.
2.  **IP Access**:
    *   Visit `http://23.21.34.9`.
    *   It should also redirect to HTTPS (note: SSL certificate warnings are expected when accessing via IP because the certificate is valid for the domain name, not the IP).
3.  **Endpoints**:
    *   Frontend: `https://paroniim.xyz/`
    *   API: `https://paroniim.xyz/api/v1/`
    *   Static Files: `https://paroniim.xyz/static/...`

## Troubleshooting

*   **Nginx Fails to Start**: Check logs with `docker-compose logs nginx`.
*   **Certbot Fails**: Ensure DNS has propagated and ports 80/443 are open. Check `docker-compose logs certbot`.
*   **Permissions**: Ensure the `certbot/` directory created has correct permissions if you encounter access errors.
