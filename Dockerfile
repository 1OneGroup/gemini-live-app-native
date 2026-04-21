FROM node:22-alpine

# Install Python + pip + build tools
RUN apk add --no-cache python3 py3-pip make g++ curl \
    freetype-dev jpeg-dev zlib-dev libpng-dev

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Install Python dependencies
COPY automation-engine/requirements.txt ./automation-engine/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir -r automation-engine/requirements.txt

# Copy all source files
COPY . .

# Create data directories
RUN mkdir -p /data/calls /data/automation

EXPOSE 8100 5001

COPY docker-start.sh /docker-start.sh
RUN chmod +x /docker-start.sh

CMD ["/docker-start.sh"]
