#!/bin/bash
echo "🐘 PostgreSQL Kontrol..."

# Docker'da mı çalışıyor?
docker ps | grep postgres && echo "PostgreSQL Docker'da" || echo "Docker'da postgres yok"

# Brew service mi?
brew services list 2>/dev/null | grep postgresql || echo "Brew postgres yok"

# Port kontrolü
lsof -i :5432 | awk 'NR<=5 {print}'

# Eğer Docker'da ise max_connections kontrol
docker exec "$(docker ps -q --filter ancestor=postgres 2>/dev/null)" psql -U postgres -c "SHOW max_connections;" 2>/dev/null || echo "Docker postgres'e erişilemedi"
