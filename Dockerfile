# --- Etapa 1: Construcción (Build) ---
# Usamos una imagen ligera de Node.js para construir nuestro proyecto
FROM node:18-alpine AS builder

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de dependencias y las instalamos
# Esto aprovecha el caché de Docker: solo se reinstala si package.json cambia
COPY package*.json ./
RUN npm install

# Copiamos el resto del código fuente de la aplicación
COPY . .

# Ejecutamos el script de construcción de Vite para generar los archivos de producción
RUN npm run build

# --- Etapa 2: Servidor (Serve) ---
# Usamos una imagen ligera y estable de Nginx para servir los archivos
FROM nginx:stable-alpine

# Copiamos los archivos construidos desde la etapa anterior al directorio web de Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiamos nuestro archivo de configuración personalizado de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponemos el puerto 80 para que el contenedor pueda recibir tráfico
EXPOSE 80

# El comando que se ejecutará cuando el contenedor inicie
CMD ["nginx", "-g", "daemon off;"]