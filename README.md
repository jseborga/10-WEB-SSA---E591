# SSA Ingenieria SRL

Landing estatica ultraligera para presentar servicios de construccion, arquitectura, supervision y diseno.

## Estructura

- `index.html`: contenido principal
- `styles.css`: estilos y responsive
- `main.js`: animaciones suaves e insercion del anio actual
- `Dockerfile`: despliegue con `nginx:alpine`
- `nginx.conf`: configuracion minima para servir la web

## Uso local

Como es una web estatica, puedes abrir `index.html` directamente o servirla con cualquier servidor simple.

## Publicar en GitHub

```bash
git init
git add .
git commit -m "Initial ultra-light SSA website"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

## Desplegar en Easypanel

1. Crea un nuevo proyecto en Easypanel.
2. Elige **App** y conecta tu repositorio de GitHub.
3. Selecciona despliegue por **Dockerfile**.
4. Usa la rama `main`.
5. Expone el puerto `80`.
6. Agrega tu dominio y activa HTTPS desde Easypanel.

## Personalizacion rapida

Antes de publicar, conviene reemplazar estos datos:

- Correo: `tu-correo@ssa.com.bo`
- WhatsApp: `+591 70000000`
- Textos de servicios y tipos de proyecto
- Titulo y descripcion SEO en `index.html`

## Referencia visual

La propuesta toma como punto de partida una presencia editorial y sobria, inspirada en estudios como `sommet.com.bo`, pero reducida a una sola pagina y sin dependencias para priorizar velocidad de carga.
