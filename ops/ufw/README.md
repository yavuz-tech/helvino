UFW baseline for single-node VPS

Commands (run as root):
1) ufw default deny incoming
2) ufw default allow outgoing
3) ufw allow 22/tcp
4) ufw allow 80/tcp
5) ufw allow 443/tcp
6) ufw enable

Optional:
- If SSH on nonstandard port, replace 22/tcp
- Consider ufw limit 22/tcp to rate limit SSH

UFW baseline rules for Helvino VPS

1) Enable firewall
   sudo ufw enable

2) Allow SSH, HTTP, HTTPS
   sudo ufw allow OpenSSH
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp

3) Deny everything else by default
   sudo ufw default deny incoming
   sudo ufw default allow outgoing

4) Check status
   sudo ufw status verbose

