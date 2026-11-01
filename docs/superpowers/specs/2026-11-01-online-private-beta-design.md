# Diseño de la beta privada online

## Intención

Convertir el prototipo local de Critical Reader en una beta privada que pueda
instalarse con un clic desde una ficha no listada de Chrome Web Store. La beta
está dirigida inicialmente a amigos del desarrollador y busca validar utilidad,
calidad de los resultados y experiencia de uso antes de invertir en una
arquitectura pública más completa.

## Resultado observable

Una persona recibe un enlace de Chrome Web Store, instala `Critical Reader
BETA`, acepta una explicación clara del tratamiento de datos y puede analizar
artículos sin ejecutar ningún servidor local. La extensión envía el artículo a
una API desplegada en Vercel, la API consulta directamente a OpenAI y devuelve
los párrafos que deben destacarse.

## Objetivos

- Publicar la extensión como no listada en Chrome Web Store.
- Desplegar la API Fastify en Vercel desde el repositorio privado de GitHub.
- Mantener la clave de OpenAI exclusivamente en variables secretas del servidor.
- Mostrar un consentimiento informado antes de enviar el primer artículo.
- Publicar términos de uso y política de privacidad accesibles sin instalar la
  extensión.
- Informar correctamente de que esta beta no tiene Zero Data Retention.
- Reducir el riesgo de abuso y gasto mediante límites de tráfico, tamaño y
  tiempo de ejecución.
- No almacenar el contenido de artículos en una base de datos, caché o logs de
  aplicación.
- Conservar el flujo local y el analizador falso para desarrollo y pruebas.
- Corregir y evaluar el falso positivo de discurso atribuido antes de publicar.

## No objetivos

- OpenRouter, selección dinámica de proveedores o ZDR.
- Garantizar residencia europea de toda la cadena de procesamiento.
- Cuentas de usuario, invitaciones individuales o revocación por persona.
- Cobros, suscripciones o uso comercial.
- Base de datos, caché distribuida o almacenamiento de artículos.
- Analítica de comportamiento o seguimiento de navegación.
- Automatizar la publicación inicial en Chrome Web Store.
- Crear un modo lector propio o integrarse con Reading Mode de Chrome.
- Soportar navegadores distintos de Chrome en esta beta.

## Decisiones y restricciones

- **Distribución:** ficha no listada de Chrome Web Store. Cualquiera que conozca
  el enlace puede instalarla.
- **Hosting:** Vercel Hobby mientras el proyecto sea personal y no comercial.
- **Runtime:** Vercel Functions con Node.js y Fastify; no se reescribe la API a
  un runtime edge.
- **Región:** Frankfurt (`fra1`) si está disponible para el proyecto. Esto reduce
  latencia desde España, pero no se presentará como garantía de residencia
  europea de extremo a extremo.
- **Proveedor de modelo:** OpenAI directo, `gpt-6-luna`, razonamiento `low`,
  Responses API y `store: false`.
- **Retención de OpenAI:** la documentación y el consentimiento indicarán que
  OpenAI puede conservar contenido en registros de prevención de abuso durante
  un máximo de 30 días. No se usará el término ZDR para esta beta.
- **Acceso:** no habrá identidad individual. La protección se basa en que la
  extensión es no listada, validación básica del cliente y límites por origen e
  IP; no se tratarán como autenticación fuerte.
- **Estado:** la API será stateless. Los límites globales exactos o diarios que
  requieran estado compartido se aplazan hasta introducir KV.

## Enfoques considerados

1. **Vercel Functions con Fastify — elegido.** Vercel soporta Fastify como una
   única función Node, integra GitHub, HTTPS, variables secretas, despliegues de
   preview y rollback. El plan Hobby encaja con una beta personal y no
   comercial.
2. **Cloudflare Workers.** Es una plataforma mainstream y económica, pero
   requeriría adaptar o sustituir Fastify y volver a validar compatibilidad con
   el SDK de OpenAI y el runtime de Workers. No aporta suficiente ventaja para
   esta beta.
3. **Railway o Render.** Mantienen un servidor Node persistente y simplifican
   límites en memoria, pero añaden un coste mensual y resultan menos atractivos
   para la preferencia actual por una plataforma serverless mainstream.

## Arquitectura

```text
Artículo abierto
      │ clic del usuario
      ▼
Extensión de Chrome
  ├─ consentimiento versionado en chrome.storage.local
  ├─ extracción local de título, subtítulo y párrafos visibles
  └─ POST HTTPS /analyze
              │
              ▼
       API Fastify en Vercel
       ├─ valida origen, versión, JSON y límites
       ├─ no guarda cuerpo ni URL
       └─ Responses API, store:false
                      │
                      ▼
                  OpenAI
```

La URL del artículo no forma parte del contrato y no se añadirá. Solo se envían
título, subtítulo y párrafos visibles que el usuario solicita analizar.

## API desplegable

La API conservará el contrato `POST /analyze` y añadirá configuración explícita
para ejecución local y producción:

- `NODE_ENV`
- `API_HOST` y `PORT`, respetando el puerto inyectado por el proveedor cuando
  corresponda.
- `ALLOWED_EXTENSION_ORIGINS`, con el origen de la extensión publicada.
- `MAX_REQUESTS_PER_WINDOW` y configuración equivalente del firewall.
- `OPENAI_API_KEY`, procedente de un proyecto OpenAI dedicado a Critical Reader.
- Las variables OpenAI existentes de modelo, base URL, esfuerzo y timeout.

El servidor impondrá:

- `Content-Type: application/json`.
- El límite existente de caracteres y párrafos, antes de llamar al modelo.
- Un límite estricto del cuerpo HTTP coherente con el contrato.
- Timeout de OpenAI de 30 segundos.
- Errores estables que no filtren claves, prompts, respuestas del proveedor ni
  stack traces.
- Registro de método, ruta, estado y latencia, pero nunca cuerpo, título,
  subtítulo, párrafos o salida del modelo.
- Fixtures disponibles localmente y deshabilitadas en producción.

Se comprobará el `Origin` de la extensión publicada y una cabecera de versión de
cliente para reducir uso accidental desde otros sitios. Ninguna de las dos se
documentará como un secreto: una extensión instalada puede inspeccionarse.

## Límites y control de costes

Vercel Firewall aplicará a `POST /analyze` una ventana fija por IP. El valor
inicial propuesto es cinco análisis por diez minutos e IP, ajustable desde la
plataforma sin publicar una nueva extensión. El resto de rutas no consumirá
cuota de OpenAI.

Además:

- Se utilizará un proyecto OpenAI independiente con presupuesto y alertas
  propios.
- Solo habrá una llamada al modelo por clic y no habrá reintentos automáticos.
- La extensión deshabilitará análisis duplicados mientras exista uno en curso.
- La API rechazará cuerpos excesivos antes de llamar a OpenAI.
- Se revisará el consumo durante la beta.

Sin un almacén compartido no habrá un contador diario global fiable en la
aplicación. Si el enlace se difunde o el límite por IP resulta insuficiente, la
respuesta será pausar la beta o adelantar el hito de KV/autenticación, no añadir
estado en memoria a una función serverless.

## Consentimiento, privacidad y términos

Antes del primer análisis, la extensión mostrará una pantalla que explique en
lenguaje directo:

- Qué se envía: título, subtítulo y texto visible de los párrafos.
- A quién: la API de Critical Reader alojada en Vercel y OpenAI.
- Para qué: producir los resaltados y explicaciones solicitados.
- Qué no se envía: historial de navegación ni análisis automáticos en segundo
  plano.
- Que Critical Reader no persiste el artículo en base de datos, caché o logs de
  aplicación.
- Que OpenAI no usa el contenido para entrenar salvo adhesión voluntaria del
  titular de la cuenta, pero puede conservarlo hasta 30 días para prevención de
  abuso en esta configuración sin ZDR.
- Que el resultado es automatizado, puede equivocarse y no constituye una
  determinación jurídica ni una valoración definitiva de personas o medios.

El usuario podrá abrir la política de privacidad y los términos antes de
aceptar. `Aceptar y analizar` guardará en `chrome.storage.local` la versión del
consentimiento. `Cancelar` cerrará la interfaz sin enviar datos. Un cambio de
versión de los textos obligará a aceptar de nuevo.

La propia API servirá tres páginas HTML públicas y sencillas:

- `/`: descripción del propósito, estado beta y contacto.
- `/privacy`: datos tratados, proveedores, retención, seguridad, derechos y
  contacto.
- `/terms`: carácter experimental, uso permitido, disponibilidad, límites,
  propiedad del contenido solicitado, exclusión de garantías y contacto.

Estas páginas no incluirán analítica, cookies ni recursos de terceros. El texto
se redactará específicamente para el comportamiento implementado. Antes de una
publicación abierta se recomienda revisión jurídica profesional; este hito no
presentará el texto como asesoramiento legal.

El responsable/editor público de la beta será **Israel Gutiérrez** y el correo
de contacto será **gootyfer@gmail.com**. Ambos aparecerán en la ficha, la
política y los términos. Esta dirección será pública y podrá recibir spam; se
podrá sustituir por un alias antes de enviar la extensión a revisión sin cambiar
la arquitectura.

## Extensión de desarrollo y producción

La URL de la API será una configuración de compilación validada, no una cadena
local fija dentro del módulo:

- Desarrollo: `http://127.0.0.1:8787`.
- Producción: dominio HTTPS de Vercel.

El manifiesto generado declarará únicamente el host correspondiente al build.
La versión de beta añadirá el permiso `storage`, justificado exclusivamente por
el consentimiento versionado. Se conservarán `activeTab` y `scripting`: el
artículo solo se lee tras un clic del usuario.

El paquete de Chrome Web Store será determinista y no contendrá `.env`, claves,
mapas de fuentes innecesarios, tests ni código del servidor.

## Preparación de Chrome Web Store

La primera publicación será manual para aprender el flujo y evitar añadir
credenciales de publicación al repositorio. El trabajo incluye:

- Registrar la cuenta de desarrollador y pagar la tarifa única.
- Crear el elemento de Chrome Web Store para obtener un ID estable.
- Usar el nombre `Critical Reader BETA` y declarar que es una versión de prueba.
- Configurar visibilidad no listada.
- Preparar iconos requeridos, una captura representativa y descripción.
- Completar propósito único, justificación de permisos y declaraciones de
  tratamiento de datos.
- Enlazar `/privacy`, `/terms` y la página principal.
- Subir el ZIP, enviar a revisión y esperar la aprobación de Google.

El ID obtenido se utilizará para configurar el origen permitido en producción.
Las actualizaciones posteriores conservarán el mismo elemento e ID.

La cuenta de desarrollador ya está registrada y la tarifa única de 5 USD ya ha
sido pagada.

## Calidad del modelo antes de publicar

El corpus híbrido incorporará los cuatro controles reales acordados:

- Artículo 3: [“El Gobierno central eleva las ayudas a programas sociales en
  Aragón mientras Vox plantea retirar fondos a varias ONG”](https://www.eldiario.es/aragon/sociedad/gobierno-central-eleva-ayudas-programas-sociales-aragon-vox-plantea-retirar-fondos-ong_1_13626729.html),
  de elDiario.es. Es la regresión principal de postura discriminatoria atribuida
  indirectamente a un partido. El párrafo congelado será: “La posición de Vox
  se ha traducido ya en una modificación concreta de las subvenciones
  autonómicas. El pasado 2 de octubre, el departamento de Nolasco publicó una
  convocatoria que eliminaba la línea específica de apoyo a personas LGTBI y
  sus familias, dotada con 161.000 euros en 2025, y concentraba los 516.000
  euros disponibles en proyectos dirigidos a personas con discapacidad.” El
  resultado esperado es siempre `findings: []`, aunque una ejecución manual
  posterior ya haya respondido correctamente.
- Artículo 4: [“Temor a la tribu, maltrato homosexual, obligaciones militares:
  la justicia rechaza 45 solicitudes de protección urgente”](https://elpais.com/espana/2026-10-28/temor-a-la-tribu-maltrato-homosexual-obligaciones-militares-la-justicia-rechaza-45-solicitudes-de-proteccion-urgente.html),
  de El País. Control de contexto judicial e informativo.
- Artículo 5: [“La madre de todos los feministas”](https://www.elespanol.com/valencia/opinion/20261030/madre-feministas/1003744440295_13.html),
  de El Español. Control de contradiscurso que menciona prejuicios para
  criticarlos.
- Artículo 6: [“Machismo sin fronteras. Racismo con responsables”](https://www.eldiario.es/aragon/el-prismatico/machismo-fronteras-racismo-responsables_132_13615402.html),
  de elDiario.es. Control de contradiscurso y análisis crítico.

Todos esperan `findings: []`. Se añadirá también un caso sintético mínimo de
atribución indirecta sin comillas. Las expectativas se fijarán antes de cambiar
el prompt. Después se reforzará la comprobación de voz narrativa, se incrementará
la versión del prompt y se ejecutará el eval real con Luna. La publicación se
bloquea si aparece cualquier falso positivo en los negativos del corpus.

## Despliegue y operación

- El repositorio de GitHub seguirá siendo privado.
- Vercel se conectará al repositorio y desplegará desde `main`.
- Los builds de preview usarán el analizador falso o una configuración sin clave
  de producción; no podrán consumir OpenAI accidentalmente.
- Producción tendrá su propia clave de un proyecto OpenAI dedicado.
- El despliegue verificará tests, typecheck y build antes de considerarse apto.
- `/health` permitirá un smoke test sin invocar el modelo.
- La aplicación conservará logs técnicos mínimos y sin contenido.
- Los cambios de prompt, términos o privacidad quedarán versionados en Git.

La primera versión no automatizará el envío a Chrome Web Store. Se documentarán
el comando de build, el archivo ZIP esperado, los pasos de subida y el rollback.

## Orden del hito

1. Congelar los nuevos casos de evaluación y corregir la atribución narrativa.
2. Hacer configurable la extensión para desarrollo y producción.
3. Adaptar y endurecer la API para Vercel sin cambiar su contrato.
4. Añadir páginas públicas de privacidad y términos.
5. Añadir el consentimiento versionado de la extensión.
6. Desplegar en Vercel y comprobar el flujo completo con una build local de
   producción.
7. Crear el elemento de Chrome Web Store, incorporar su ID y preparar activos.
8. Ejecutar todas las verificaciones y el eval real.
9. Subir manualmente la versión no listada y enviarla a revisión.
10. Tras la aprobación, probar instalación y análisis desde un perfil de Chrome
    distinto antes de compartir el enlace.

## Criterios de aceptación

- La extensión se instala desde el enlace no listado sin modo desarrollador.
- Antes del primer envío aparece el consentimiento y cancelar no produce red.
- La política y los términos describen fielmente los datos y proveedores.
- La API pública usa HTTPS y no expone la clave de OpenAI.
- La extensión local sigue funcionando contra `127.0.0.1`.
- Una petición válida produce los mismos resaltados que el prototipo local.
- Peticiones excesivas, de origen no permitido o con cuerpo inválido se rechazan
  sin llamar a OpenAI.
- Logs y respuestas de error no contienen texto del artículo ni datos del
  proveedor.
- Los casos reales 3–6 y todos los negativos existentes producen cero falsos
  positivos en el eval de publicación.
- Tests, typecheck y build pasan en una instalación limpia.
- Un segundo perfil de Chrome completa instalación, consentimiento y análisis.

## Hito posterior

La siguiente fase podrá implementar un adaptador OpenRouter sobre el puerto de
modelo existente. Exigirá por petición ZDR y prohibición de recopilación, sin
fallback a endpoints incompatibles. En esa fase se reevaluarán proveedor,
calidad, coste, residencia regional, KV para caché/cuotas y acceso individual.

## Referencias operativas

- [Fastify en Vercel](https://vercel.com/docs/frameworks/backend/fastify)
- [Límites y duración de Vercel Functions](https://vercel.com/docs/functions/limitations)
- [Condiciones de Vercel Hobby](https://vercel.com/docs/limits/fair-use-guidelines)
- [Distribución no listada de Chrome Web Store](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [Política de datos de Chrome Web Store](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Controles de datos de OpenAI](https://developers.openai.com/api/docs/guides/your-data)
