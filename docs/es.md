# Carbon Intensity UK

Lo limpia que es la electricidad británica, ahora y en las próximas 24 horas,
según la [API Carbon Intensity](https://carbonintensity.org.uk) oficial de NESO
(National Energy System Operator, antes National Grid ESO). Para toda Gran
Bretaña, una región o su código postal. Esta integración no tiene relación con
NESO.

## Presentación

Para cada zona seguida (Gran Bretaña, región, código postal), la integración
añade un dispositivo con:

- la **intensidad de carbono** de la electricidad de la media hora en curso, en
  gCO₂/kWh, y el **índice** de NESO (muy bajo → muy alto);
- el **mix eléctrico**: cuota eólica, solar, nuclear, de gas, de
  importaciones, de biomasa, hidráulica, de carbón y de otras fuentes, más las
  cuotas baja en carbono y renovable;
- la **mejor franja** de las próximas 24 horas: cuándo empieza el periodo más
  limpio de la duración elegida (3 horas por defecto), dentro de cuántos
  minutos, y su intensidad media.

Además: un widget del panel con la curva prevista a 24 h, dos disparadores de
escena («Índice de carbono pasa a bajo», «Empieza la mejor franja») y una
acción de escena que busca la mejor franja de cualquier duración, para poner el
lavavajillas o cargar el coche cuando la red está más limpia.

## Requisitos

- Gladys Assistant 5.3.0 o posterior.
- Gladys debe acceder a `api.carbonintensity.org.uk` en Internet. Sin cuenta
  ni clave: los datos son abiertos, bajo licencia CC BY 4.0.
- Las zonas están en Gran Bretaña (Inglaterra, Escocia, Gales): la API no
  cubre Irlanda del Norte.

## Configuración

1. Instale la integración (**Integraciones → Instalar desde GitHub**, y luego
   la dirección del repositorio).
2. En su pestaña **Configuración**:
   - **Idioma de los nombres**: idioma de los nombres de dispositivos y
     funciones (fijados al añadir un dispositivo) y de los textos enviados a las
     escenas;
   - **Gran Bretaña entera**: un dispositivo para las cifras nacionales
     (activado por defecto);
   - **Regiones**: cualquiera de las 14 regiones de las redes de distribución,
     más Inglaterra, Escocia y Gales;
   - **Códigos postales**: hasta cinco códigos postales británicos, separados
     por comas. Solo cuenta la primera parte (`RG10` para `RG10 9AB`): la API
     deduce la región. Su código postal completo nunca se envía;
   - **Duración de la mejor franja**: de 30 minutos a 6 horas.
3. Guarde y añada los dispositivos desde la pestaña **Descubrimiento**.

### Botón «Probar la conexión»

Lee todas las zonas a la vez y muestra su intensidad actual, o lo que falla
(sin respuesta, código postal desconocido para la API, texto que no es un
código postal).

## Dispositivos

### Intensidad de carbono (uno por zona)

| Función                                | Valor                                                    |
| -------------------------------------- | -------------------------------------------------------- |
| Intensidad de carbono                  | gCO₂/kWh de la media hora en curso                       |
| Índice de carbono (1 a 5)              | 1 muy bajo, 2 bajo, 3 moderado, 4 alto, 5 muy alto       |
| Índice de carbono                      | el mismo índice, en palabras                             |
| Cuota baja en carbono, cuota renovable | %                                                        |
| Cuota eólica, solar, de gas…           | % de cada fuente, redondeado                             |
| Inicio de la mejor franja              | hora, por ejemplo `03:00`                                |
| Mejor franja dentro de                 | minutos, redondeado a 5 hacia arriba, 0 una vez empezada |
| Intensidad de la mejor franja          | su media en gCO₂/kWh                                     |

La intensidad es la **previsión** de NESO para la media hora en curso: la API no
tiene valor medido para las regiones, ni para la media hora en curso. «Baja en
carbono» cuenta la eólica, la solar, la hidráulica, la biomasa y la nuclear;
las importaciones y las «otras» no cuentan ni a favor ni en contra.

## Widget

**Previsión de carbono** muestra, para la zona elegida en sus ajustes (la
primera por defecto): la intensidad actual y el índice, el inicio de la mejor
franja, la curva prevista de las próximas 24 horas con la mejor franja y la
hora actual marcadas, y el mix eléctrico de la media hora en barras. Dos
ajustes ocultan la mejor franja y el mix.

## Escenas

### Índice de carbono pasa a bajo (disparador)

Se activa cuando el índice de una zona pasa de moderado (o peor) a bajo o muy
bajo. Filtros: la zona, el índice alcanzado. Variables: `level` (`very_low`,
`low`), `index` (1, 2), `index_label`, `intensity`, `zone`.

### Empieza la mejor franja (disparador)

Se activa cuando la media hora en curso abre la franja más limpia de las
próximas 24 horas, para la duración fijada en la configuración, una vez por
franja. Filtro: la zona. Variables: `duration_minutes`, `average_intensity`,
`end_time`, `zone`. En una zona que se queda en 0 g/kWh (a menudo el sur de
Escocia), todas las franjas son igual de limpias: se activa de nuevo al final de
cada una. La franja se busca cada media hora en un horizonte que avanza: una
franja más limpia que entra en él puede sustituir a la anunciada en los
dispositivos antes de que empiece.

### Buscar la mejor franja (acción)

Elija una zona y una duración: la acción devuelve `start_time`, `end_time`,
`minutes_until` y `average_intensity` a las acciones siguientes de la escena,
por ejemplo para enviarse «Poner la lavadora a las 02:30» (elíjalas en la lista
de variables del editor de escenas).

## Ejemplos de escenas

- Cada noche a las 20:00, **Buscar la mejor franja** de 2 horas, y luego enviar
  «Mejor momento para el lavavajillas:» seguido de la hora de inicio, elegida en
  la lista de variables.
- **Empieza la mejor franja** → encender el enchufe del cargador del coche;
  una escena programada lo apaga por la mañana.
- **Índice de carbono pasa a bajo** → encender el termo eléctrico, con una
  condición sobre la hora.

## Límites

- Datos cada media hora: la integración lee cada zona una vez por media hora
  (dos llamadas para Gran Bretaña, una para una región o un código postal),
  solo si su dispositivo está añadido o su widget mostrado. La API no pide
  clave ni anuncia cuota; se usa con esta moderación.
- Si la API no responde, los dispositivos siguen la última previsión a 48 h, y
  la pantalla de configuración indica las zonas que no se pueden leer.
- Las horas están en la zona horaria de Gladys.

## Solución de problemas

- **«No se puede leer: RG10»**: la API no conoce ese código postal, o no
  responde. El botón **Probar la conexión** indica cuál de los dos.
- **Ningún dispositivo en Descubrimiento**: no se sigue ninguna zona; marque
  Gran Bretaña o elija una región o un código postal.
- Registros: la integración anota su inicio, las zonas seguidas y los fallos.
  Para más detalle, defina la variable de entorno `LOG_LEVEL=debug`.

## Créditos

Datos: API Carbon Intensity de NESO, CC BY 4.0 — «Carbon Intensity data from
NESO». Documentación de la API:
<https://carbon-intensity.github.io/api-definitions/>. Esta integración no
tiene relación con NESO.
