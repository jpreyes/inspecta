// GENERADO por scripts/build_catalog_ts.py — no editar a mano.
// Catálogo de inspección por tipo de estructura (edificio, puente).

export interface CatalogElement { element: string; materials: string[]; zones: string[] }
export interface CatalogComponent { component: string; elements: CatalogElement[] }
export interface CatalogDamage { name: string; materials: string[]; severity: string[] }
export interface StructureCatalog {
  components: CatalogComponent[]
  damages: CatalogDamage[]
  causesByDamage: Record<string, string[]>
}

export const MATERIALS: string[] = ["Hormigón armado", "Hormigón pretensado/postensado", "Acero", "Madera", "Albañilería confinada", "Albañilería armada", "Albañilería simple", "Mixto acero-hormigón", "Elastomérico", "Otro"]

export const CATALOG: Record<string, StructureCatalog> = {
  "edificio": {
    "components": [
      {
        "component": "Fundaciones",
        "elements": [
          {
            "element": "Zapata aislada",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Cara superior",
              "Pedestal",
              "Perímetro",
              "Otro"
            ]
          },
          {
            "element": "Zapata corrida",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Cara superior",
              "Cara lateral",
              "Otro"
            ]
          },
          {
            "element": "Viga de fundación",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Apoyo",
              "Centro de vano",
              "Nudo",
              "Otro"
            ]
          },
          {
            "element": "Losa de fundación (radier)",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Centro de paño",
              "Borde",
              "Junta",
              "Otro"
            ]
          },
          {
            "element": "Pilote",
            "materials": [
              "Hormigón armado",
              "Acero",
              "Madera"
            ],
            "zones": [
              "Cabeza",
              "Fuste",
              "Punta",
              "Anclaje/empotramiento",
              "Otro"
            ]
          },
          {
            "element": "Cabezal de pilotes",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Cara superior",
              "Encuentro con pilote",
              "Otro"
            ]
          },
          {
            "element": "Sobrecimiento",
            "materials": [
              "Hormigón armado",
              "Albañilería confinada"
            ],
            "zones": [
              "Base",
              "Coronación",
              "Otro"
            ]
          },
          {
            "element": "Muro de subterráneo",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Base",
              "Coronación",
              "Paño central",
              "Junta",
              "Otro"
            ]
          }
        ]
      },
      {
        "component": "Muros estructurales",
        "elements": [
          {
            "element": "Muro estructural / de corte",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Base",
              "Coronación",
              "Paño central",
              "Encuentro/esquina",
              "Vano/abertura",
              "Otro"
            ]
          },
          {
            "element": "Viga de acople (dintel de acople)",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Empotramiento en muro",
              "Tramo/centro",
              "Armadura diagonal",
              "Otro"
            ]
          },
          {
            "element": "Machón",
            "materials": [
              "Hormigón armado",
              "Albañilería confinada"
            ],
            "zones": [
              "Base",
              "Cuerpo",
              "Encuentro",
              "Otro"
            ]
          },
          {
            "element": "Muro de albañilería confinada",
            "materials": [
              "Albañilería confinada"
            ],
            "zones": [
              "Paño central",
              "Encuentro",
              "Base",
              "Bajo cadena/pilar",
              "Vano",
              "Otro"
            ]
          },
          {
            "element": "Muro de albañilería armada",
            "materials": [
              "Albañilería armada"
            ],
            "zones": [
              "Paño central",
              "Encuentro",
              "Base",
              "Vano",
              "Otro"
            ]
          },
          {
            "element": "Muro de contención",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Coronación",
              "Fuste/pantalla",
              "Base/empotramiento",
              "Puntera",
              "Talón",
              "Junta",
              "Drenaje/barbacana",
              "Otro"
            ]
          }
        ]
      },
      {
        "component": "Pilares y columnas",
        "elements": [
          {
            "element": "Columna / Pilar",
            "materials": [
              "Hormigón armado",
              "Acero",
              "Madera",
              "Mixto acero-hormigón"
            ],
            "zones": [
              "Base",
              "Anclaje / placa base",
              "Tercio central",
              "Cabeza/capitel",
              "Nudo",
              "Empalme",
              "Otro"
            ]
          }
        ]
      },
      {
        "component": "Vigas y cadenas",
        "elements": [
          {
            "element": "Viga",
            "materials": [
              "Hormigón armado",
              "Hormigón pretensado/postensado",
              "Acero",
              "Madera",
              "Mixto acero-hormigón"
            ],
            "zones": [
              "Apoyo/extremo",
              "Centro de vano",
              "Fondo de viga",
              "Nudo",
              "Anclaje de pretensado",
              "Anclaje de conexión",
              "Cara lateral",
              "Otro"
            ]
          },
          {
            "element": "Cadena",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Tramo",
              "Encuentro",
              "Otro"
            ]
          },
          {
            "element": "Dintel",
            "materials": [
              "Hormigón armado",
              "Acero",
              "Albañilería confinada"
            ],
            "zones": [
              "Centro",
              "Apoyo",
              "Otro"
            ]
          }
        ]
      },
      {
        "component": "Losas y entrepisos",
        "elements": [
          {
            "element": "Losa",
            "materials": [
              "Hormigón armado",
              "Hormigón pretensado/postensado"
            ],
            "zones": [
              "Centro de paño",
              "Borde/perímetro",
              "Cara inferior",
              "Cara superior",
              "Junta",
              "Perforación/paso de instalaciones",
              "Zona de punzonamiento (sobre columna)",
              "Otro"
            ]
          },
          {
            "element": "Losa colaborante",
            "materials": [
              "Mixto acero-hormigón"
            ],
            "zones": [
              "Centro de paño",
              "Apoyo",
              "Conexión de corte",
              "Otro"
            ]
          },
          {
            "element": "Vigueta",
            "materials": [
              "Hormigón armado",
              "Hormigón pretensado/postensado",
              "Acero",
              "Madera"
            ],
            "zones": [
              "Apoyo",
              "Centro de vano",
              "Fondo",
              "Otro"
            ]
          },
          {
            "element": "Voladizo / balcón",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Empotramiento",
              "Extremo",
              "Cara inferior",
              "Otro"
            ]
          }
        ]
      },
      {
        "component": "Nudos y conexiones",
        "elements": [
          {
            "element": "Nudo viga-columna",
            "materials": [
              "Hormigón armado",
              "Acero"
            ],
            "zones": [
              "Núcleo del nudo",
              "Extremo de viga",
              "Extremo de columna",
              "Otro"
            ]
          },
          {
            "element": "Conexión soldada",
            "materials": [
              "Acero"
            ],
            "zones": [
              "Cordón de soldadura",
              "Placa",
              "Otro"
            ]
          },
          {
            "element": "Conexión apernada",
            "materials": [
              "Acero"
            ],
            "zones": [
              "Perno",
              "Placa",
              "Otro"
            ]
          },
          {
            "element": "Anclaje",
            "materials": [
              "Acero",
              "Hormigón armado"
            ],
            "zones": [
              "Placa base",
              "Perno de anclaje",
              "Anclaje de pretensado",
              "Anclaje químico",
              "Anclaje mecánico",
              "Otro"
            ]
          },
          {
            "element": "Empalme de armadura",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Traslapo",
              "Manguito",
              "Otro"
            ]
          },
          {
            "element": "Apoyo / junta de dilatación",
            "materials": [
              "Hormigón armado",
              "Acero",
              "Elastomérico"
            ],
            "zones": [
              "Aparato de apoyo",
              "Junta",
              "Otro"
            ]
          }
        ]
      },
      {
        "component": "Escaleras",
        "elements": [
          {
            "element": "Losa de escalera",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Tramo",
              "Descanso",
              "Apoyo",
              "Otro"
            ]
          },
          {
            "element": "Peldañeado",
            "materials": [
              "Hormigón armado",
              "Madera",
              "Acero"
            ],
            "zones": [
              "Peldaño",
              "Nariz",
              "Otro"
            ]
          },
          {
            "element": "Zanca / viga de escalera",
            "materials": [
              "Hormigón armado",
              "Acero",
              "Madera"
            ],
            "zones": [
              "Apoyo",
              "Tramo",
              "Anclaje",
              "Otro"
            ]
          },
          {
            "element": "Rampa",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Tramo",
              "Apoyo",
              "Otro"
            ]
          }
        ]
      },
      {
        "component": "Techumbre estructural",
        "elements": [
          {
            "element": "Cercha",
            "materials": [
              "Acero",
              "Madera"
            ],
            "zones": [
              "Cordón superior",
              "Cordón inferior",
              "Diagonal",
              "Montante",
              "Nudo",
              "Anclaje/apoyo",
              "Otro"
            ]
          },
          {
            "element": "Tijeral",
            "materials": [
              "Madera",
              "Acero"
            ],
            "zones": [
              "Cordón superior",
              "Cordón inferior",
              "Diagonal",
              "Pendolón",
              "Nudo",
              "Apoyo/anclaje",
              "Otro"
            ]
          },
          {
            "element": "Viga de techo",
            "materials": [
              "Acero",
              "Madera",
              "Hormigón armado"
            ],
            "zones": [
              "Apoyo",
              "Centro de vano",
              "Anclaje",
              "Otro"
            ]
          },
          {
            "element": "Costanera / correa",
            "materials": [
              "Acero",
              "Madera"
            ],
            "zones": [
              "Apoyo",
              "Tramo",
              "Conexión",
              "Otro"
            ]
          },
          {
            "element": "Entramado / diafragma de techumbre",
            "materials": [
              "Madera",
              "Acero"
            ],
            "zones": [
              "Paño",
              "Arriostramiento",
              "Encuentro/anclaje",
              "Otro"
            ]
          },
          {
            "element": "Losa de cubierta",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Centro de paño",
              "Borde",
              "Junta",
              "Otro"
            ]
          }
        ]
      },
      {
        "component": "Tabiquería",
        "elements": [
          {
            "element": "Tabique",
            "materials": [
              "Albañilería confinada",
              "Otro"
            ],
            "zones": [
              "Paño central",
              "Encuentro",
              "Base",
              "Vano",
              "Otro"
            ]
          },
          {
            "element": "Antepecho / parapeto",
            "materials": [
              "Hormigón armado",
              "Albañilería confinada"
            ],
            "zones": [
              "Coronación",
              "Base",
              "Otro"
            ]
          }
        ]
      }
    ],
    "damages": [
      {
        "name": "Fisuras",
        "materials": [
          "Hormigón armado",
          "Albañilería confinada",
          "Madera"
        ],
        "severity": [
          "abertura < 0,2 mm, sin incidencia estructural",
          "0,2-0,4 mm o incidencia estructural leve",
          "0,4-1 mm con incidencia estructural",
          "> 1 mm, evolutiva o generalizada"
        ]
      },
      {
        "name": "Grietas",
        "materials": [
          "Hormigón armado",
          "Albañilería confinada"
        ],
        "severity": [
          "~1 mm, pasante, sin incidencia estructural aparente",
          "1-2 mm con incidencia estructural",
          "2-5 mm",
          "> 5 mm, evolutiva; compromete estabilidad"
        ]
      },
      {
        "name": "Fisuras en mapa o retícula",
        "materials": [
          "Hormigón armado"
        ],
        "severity": [
          "fisuración superficial fina, sin desprendimientos",
          "retícula marcada con inicio de disgregación superficial",
          "fisuración con desprendimiento de árido y avance en profundidad",
          "generalizada, con pérdida de material y afectación de armadura"
        ]
      },
      {
        "name": "Descascaramiento sin armadura a la vista",
        "materials": [
          "Hormigón armado"
        ],
        "severity": [
          "desprendimiento puntual del recubrimiento, sin llegar a la armadura",
          "descascaramiento localizado, recubrimiento reducido",
          "descascaramiento extenso, armadura a punto de quedar expuesta",
          "pérdida generalizada del recubrimiento en la zona"
        ]
      },
      {
        "name": "Descascaramiento con armadura a la vista",
        "materials": [
          "Hormigón armado"
        ],
        "severity": [
          "sin pérdida de sección de armadura",
          "pérdida leve (<10%)",
          "pérdida apreciable (10-50%)",
          "pérdida > 50% o barras seccionadas"
        ]
      },
      {
        "name": "Armadura a la vista",
        "materials": [
          "Hormigón armado"
        ],
        "severity": [
          "armadura expuesta sin corrosión, puntual",
          "armadura expuesta con oxidación superficial",
          "expuesta con corrosión y pérdida de sección leve",
          "expuesta y corroída, con pérdida de sección significativa o barras seccionadas"
        ]
      },
      {
        "name": "Corrosión de armaduras/acero",
        "materials": [
          "Hormigón armado",
          "Acero"
        ],
        "severity": [
          "oxidación superficial, <10%, sin pérdida",
          "pérdida leve (10-25%)",
          "pérdida apreciable (25-50%)",
          "pérdida > 50% o seccionamiento"
        ]
      },
      {
        "name": "Mancha de óxido",
        "materials": [
          "Hormigón armado",
          "Acero"
        ],
        "severity": [
          "mancha superficial aislada, sin fisura asociada",
          "manchas recurrentes, posible corrosión incipiente bajo recubrimiento",
          "manchas con fisura o abombamiento del recubrimiento",
          "generalizadas, con descascaramiento y armadura corroída"
        ]
      },
      {
        "name": "Coqueras / nidos de grava",
        "materials": [
          "Hormigón armado"
        ],
        "severity": [
          "coquera superficial pequeña, sin armadura expuesta",
          "coquera localizada con recubrimiento reducido",
          "coquera profunda con armadura expuesta",
          "nidos extensos que comprometen sección o anclaje de armadura"
        ]
      },
      {
        "name": "Humedades / filtraciones",
        "materials": [
          "todos"
        ],
        "severity": [
          "mancha superficial, sin daño",
          "humedad persistente, inicio de deterioro",
          "filtración activa con daño",
          "filtración severa con corrosión/pérdida"
        ]
      },
      {
        "name": "Eflorescencias",
        "materials": [
          "Hormigón armado",
          "Albañilería confinada"
        ],
        "severity": [
          "depósito salino leve, superficie seca",
          "eflorescencia con humedad asociada",
          "persistente, con inicio de disgregación/lixiviación",
          "lixiviación activa (lavado/estalactitas) con deterioro del material"
        ]
      },
      {
        "name": "Deformación / flecha excesiva",
        "materials": [
          "todos"
        ],
        "severity": [
          "perceptible, < L/500",
          "L/500-L/250",
          "L/250-L/150",
          "> L/150 o creciente"
        ]
      },
      {
        "name": "Falta de alineación / desplome",
        "materials": [
          "todos"
        ],
        "severity": [
          "desviación perceptible dentro de tolerancias, sin daño asociado",
          "desplome apreciable, sin fisuración estructural",
          "desplome con fisuración asociada / fuera de tolerancia",
          "desplome severo o creciente que compromete la estabilidad"
        ]
      },
      {
        "name": "Disgregación / pulverización",
        "materials": [
          "Hormigón armado",
          "Albañilería confinada"
        ],
        "severity": [
          "disgregación superficial leve, material pulverulento puntual",
          "pérdida de mortero/árido superficial",
          "disgregación en profundidad con reducción de sección",
          "pérdida de material generalizada con armadura expuesta o comprometida"
        ]
      },
      {
        "name": "Aplastamiento (albañilería)",
        "materials": [
          "Albañilería confinada",
          "Hormigón armado"
        ],
        "severity": [
          "fisuras finas por compresión, sin desprendimiento",
          "fisuración vertical marcada, inicio de desconche de unidades",
          "aplastamiento local con desprendimiento de piezas",
          "generalizado, con pérdida de capacidad portante"
        ]
      },
      {
        "name": "Pandeo local",
        "materials": [
          "Acero"
        ],
        "severity": [
          "abolladura leve de ala/alma, sin plastificación",
          "pandeo local apreciable, sin pérdida de capacidad evidente",
          "pandeo con plastificación local",
          "pandeo severo con pérdida de capacidad o colapso local inminente"
        ]
      },
      {
        "name": "Pérdida de mortero de junta",
        "materials": [
          "Albañilería confinada"
        ],
        "severity": [
          "pérdida superficial de mortero (< 1 cm)",
          "juntas erosionadas, profundidad moderada",
          "pérdida en profundidad, holgura entre piezas",
          "juntas vacías generalizadas, inestabilidad de piezas"
        ]
      },
      {
        "name": "Pérdida de tratamiento protector",
        "materials": [
          "Acero",
          "Madera"
        ],
        "severity": [
          "deterioro puntual de pintura/galvanizado, sin corrosión",
          "pérdida localizada con oxidación superficial incipiente",
          "pérdida extensa con corrosión activa",
          "ausencia total de protección con corrosión avanzada"
        ]
      },
      {
        "name": "Pudrición / xilófagos",
        "materials": [
          "Madera"
        ],
        "severity": [
          "ataque superficial o indicios (galerías), sin pérdida de sección",
          "pudrición o ataque localizado con pérdida de sección leve",
          "pudrición en profundidad con pérdida de sección apreciable",
          "pérdida de sección severa; sin capacidad resistente fiable"
        ]
      },
      {
        "name": "Deterioro de soldadura / conexión",
        "materials": [
          "Acero"
        ],
        "severity": [
          "defecto superficial (salpicadura, mordedura leve), sin fisura",
          "corrosión o fisura fina en el cordón, sin pérdida de capacidad",
          "fisura en soldadura o pérdida de garganta apreciable",
          "fisura pasante o rotura de la conexión"
        ]
      },
      {
        "name": "Pérdida / aflojamiento de pernos y anclajes",
        "materials": [
          "Acero",
          "Hormigón armado"
        ],
        "severity": [
          "pernos con oxidación superficial, apriete correcto",
          "aflojamiento leve o falta puntual de pernos no críticos",
          "varios pernos flojos/faltantes o corrosión con pérdida de sección",
          "pérdida generalizada o anclaje sin capacidad; conexión comprometida"
        ]
      },
      {
        "name": "Alteración superficial",
        "materials": [
          "todos"
        ],
        "severity": [
          "suciedad, pátina o decoloración, sin daño del material",
          "erosión/abrasión superficial leve",
          "alteración con pérdida de material superficial",
          "alteración profunda que reduce sección o recubrimiento"
        ]
      },
      {
        "name": "Vegetación / biológico",
        "materials": [
          "todos"
        ],
        "severity": [
          "presencia de musgo/líquenes, sin daño",
          "vegetación menor con retención de humedad",
          "raíces o vegetación con fisuración/disgregación asociada",
          "vegetación arraigada que abre juntas o desplaza elementos"
        ]
      }
    ],
    "causesByDamage": {
      "Fisuras": [
        "retracción del hormigón",
        "dilatación/contracción térmica",
        "curado inadecuado",
        "asiento diferencial",
        "sobrecarga",
        "deficiente ejecución",
        "causa desconocida"
      ],
      "Grietas": [
        "acción sísmica",
        "asiento diferencial",
        "sobrecarga gravitacional",
        "esfuerzos (corte)",
        "esfuerzos (flexión)",
        "corrosión de armaduras",
        "empuje de terreno",
        "deficiente diseño",
        "causa desconocida"
      ],
      "Fisuras en mapa o retícula": [
        "retracción",
        "ataque químico",
        "reacción árido-álcali",
        "corrosión de armaduras",
        "ciclos hielo-deshielo",
        "deficiente ejecución"
      ],
      "Descascaramiento sin armadura a la vista": [
        "golpe o impacto",
        "ciclos hielo-deshielo",
        "ataque químico",
        "deficiente ejecución",
        "causa desconocida"
      ],
      "Descascaramiento con armadura a la vista": [
        "corrosión de armaduras",
        "carbonatación",
        "ataque de cloruros",
        "escasez de recubrimiento",
        "deficiente ejecución"
      ],
      "Armadura a la vista": [
        "escasez de recubrimiento",
        "corrosión de armaduras",
        "desconchón previo",
        "deficiente ejecución"
      ],
      "Corrosión de armaduras/acero": [
        "carbonatación",
        "ataque de cloruros",
        "humedad/filtración",
        "escasez de recubrimiento",
        "ambiente agresivo/marino",
        "falta de mantención"
      ],
      "Mancha de óxido": [
        "corrosión de armaduras",
        "humedad",
        "escorrentía superficial",
        "falta de limpieza del encofrado"
      ],
      "Coqueras / nidos de grava": [
        "deficiente ejecución (vibrado)",
        "deficiente dosificación",
        "causa desconocida"
      ],
      "Humedades / filtraciones": [
        "impermeabilización defectuosa",
        "rotura de conducción",
        "capilaridad",
        "condensación",
        "mal drenaje",
        "falta de mantención"
      ],
      "Eflorescencias": [
        "humedad/filtración",
        "capilaridad",
        "impermeabilización defectuosa",
        "sales del material"
      ],
      "Deformación / flecha excesiva": [
        "sobrecarga",
        "infradimensionamiento",
        "fluencia (creep) del hormigón",
        "cambio de uso",
        "esfuerzos (flexión)",
        "pandeo"
      ],
      "Falta de alineación / desplome": [
        "asiento diferencial",
        "acción sísmica",
        "empuje de terreno",
        "deficiente ejecución"
      ],
      "Disgregación / pulverización": [
        "ataque químico",
        "ciclos hielo-deshielo",
        "carbonatación avanzada",
        "curado inadecuado",
        "calidad deficiente del hormigón"
      ],
      "Aplastamiento (albañilería)": [
        "sobrecarga",
        "acción sísmica",
        "infradimensionamiento",
        "concentración de esfuerzos"
      ],
      "Pandeo local": [
        "sobrecarga (compresión)",
        "esbeltez excesiva",
        "arriostramiento insuficiente",
        "infradimensionamiento",
        "impacto"
      ],
      "Pérdida de mortero de junta": [
        "envejecimiento",
        "humedad",
        "ataque químico",
        "deficiente ejecución",
        "acción sísmica"
      ],
      "Pérdida de tratamiento protector": [
        "envejecimiento",
        "acción climática",
        "falta de mantención",
        "corrosión",
        "ataque químico"
      ],
      "Pudrición / xilófagos": [
        "humedad",
        "hongos",
        "insectos xilófagos",
        "falta de protección/mantención"
      ],
      "Deterioro de soldadura / conexión": [
        "fatiga",
        "corrosión",
        "deficiente ejecución",
        "esfuerzos cíclicos",
        "sobrecarga"
      ],
      "Pérdida / aflojamiento de pernos y anclajes": [
        "corrosión",
        "aflojamiento por vibración",
        "deficiente ejecución",
        "esfuerzos cíclicos",
        "sobrecarga",
        "acción sísmica"
      ],
      "Alteración superficial": [
        "acción climática",
        "envejecimiento",
        "ataque químico",
        "abrasión",
        "pérdida de tratamiento"
      ],
      "Vegetación / biológico": [
        "humedad",
        "sedimentación orgánica",
        "falta de mantención"
      ]
    }
  },
  "puente": {
    "components": [
      {
        "component": "Estribo",
        "elements": [
          {
            "element": "Fundación",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Cara superior",
              "Cara lateral",
              "Descalce",
              "Otro"
            ]
          },
          {
            "element": "Muro frontal portante",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Base",
              "Cuerpo/paño",
              "Coronación",
              "Encuentro",
              "Cara vista",
              "Junta",
              "Otro"
            ]
          },
          {
            "element": "Guardalastres",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Coronación",
              "Cuerpo",
              "Encuentro con losa",
              "Cara vista",
              "Otro"
            ]
          },
          {
            "element": "Alas",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Base",
              "Cuerpo/paño",
              "Coronación",
              "Encuentro",
              "Cara vista",
              "Junta",
              "Otro"
            ]
          }
        ]
      },
      {
        "component": "Líneas de apoyo",
        "elements": [
          {
            "element": "Aparato de apoyo",
            "materials": [
              "Elastomérico",
              "Acero"
            ],
            "zones": [
              "Cuerpo",
              "Anclaje",
              "Otro"
            ]
          },
          {
            "element": "Cama de nivelación",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Cuerpo",
              "Contacto con apoyo",
              "Otro"
            ]
          }
        ]
      },
      {
        "component": "Cepa",
        "elements": [
          {
            "element": "Columnas",
            "materials": [
              "Hormigón armado",
              "Acero"
            ],
            "zones": [
              "Base",
              "Anclaje / placa base",
              "Fuste/tercio central",
              "Cabeza/capitel",
              "Nudo",
              "Otro"
            ]
          },
          {
            "element": "Fundación",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Cara superior",
              "Cara lateral",
              "Descalce",
              "Otro"
            ]
          }
        ]
      },
      {
        "component": "Muro ala",
        "elements": [
          {
            "element": "Línea de contención",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Tramo",
              "Anclaje",
              "Cara vista",
              "Junta",
              "Otro"
            ]
          },
          {
            "element": "Alas",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Base",
              "Cuerpo/paño",
              "Coronación",
              "Encuentro",
              "Cara vista",
              "Junta",
              "Otro"
            ]
          }
        ]
      },
      {
        "component": "Tablero",
        "elements": [
          {
            "element": "Longuerina",
            "materials": [
              "Hormigón armado",
              "Hormigón pretensado/postensado",
              "Acero"
            ],
            "zones": [
              "Apoyo",
              "Centro de vano",
              "Anclaje de pretensado",
              "Otro"
            ]
          },
          {
            "element": "Cabezal superior",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Apoyo",
              "Centro",
              "Voladizo",
              "Cara inferior",
              "Nudo",
              "Otro"
            ]
          },
          {
            "element": "Cabezal inferior",
            "materials": [
              "Hormigón armado"
            ],
            "zones": [
              "Apoyo",
              "Centro",
              "Voladizo",
              "Cara inferior",
              "Nudo",
              "Otro"
            ]
          },
          {
            "element": "Diagonal",
            "materials": [
              "Acero",
              "Hormigón armado"
            ],
            "zones": [
              "Tramo",
              "Nudo/conexión",
              "Anclaje",
              "Otro"
            ]
          },
          {
            "element": "Montante",
            "materials": [
              "Acero",
              "Hormigón armado"
            ],
            "zones": [
              "Tramo",
              "Nudo/conexión",
              "Anclaje",
              "Otro"
            ]
          },
          {
            "element": "Voladizo",
            "materials": [
              "Hormigón armado",
              "Hormigón pretensado/postensado"
            ],
            "zones": [
              "Empotramiento",
              "Extremo",
              "Cara inferior",
              "Anclaje de pretensado",
              "Otro"
            ]
          },
          {
            "element": "Travesaño intermedia",
            "materials": [
              "Hormigón armado",
              "Hormigón pretensado/postensado"
            ],
            "zones": [
              "Apoyo",
              "Centro de vano",
              "Fondo",
              "Anclaje de pretensado",
              "Otro"
            ]
          },
          {
            "element": "Travesaño Apoyo",
            "materials": [
              "Hormigón armado",
              "Hormigón pretensado/postensado"
            ],
            "zones": [
              "Apoyo",
              "Centro de vano",
              "Fondo",
              "Anclaje de pretensado",
              "Otro"
            ]
          },
          {
            "element": "Contraventación",
            "materials": [
              "Acero"
            ],
            "zones": [
              "Tramo",
              "Conexión",
              "Anclaje",
              "Otro"
            ]
          },
          {
            "element": "Vigas",
            "materials": [
              "Hormigón armado",
              "Hormigón pretensado/postensado",
              "Acero"
            ],
            "zones": [
              "Apoyo/extremo",
              "Centro de vano",
              "Fondo de viga",
              "Anclaje de pretensado",
              "Cara lateral",
              "Otro"
            ]
          },
          {
            "element": "Losa",
            "materials": [
              "Hormigón armado",
              "Hormigón pretensado/postensado"
            ],
            "zones": [
              "Centro de paño",
              "Borde/perímetro",
              "Cara inferior",
              "Junta",
              "Otro"
            ]
          },
          {
            "element": "Cartela",
            "materials": [
              "Hormigón armado",
              "Acero"
            ],
            "zones": [
              "Nudo",
              "Cara vista",
              "Conexión",
              "Otro"
            ]
          }
        ]
      },
      {
        "component": "Anclajes y conexiones",
        "elements": [
          {
            "element": "Anclaje de pretensado",
            "materials": [
              "Hormigón pretensado/postensado",
              "Acero"
            ],
            "zones": [
              "Zona de anclaje",
              "Placa",
              "Otro"
            ]
          },
          {
            "element": "Anclaje / placa base",
            "materials": [
              "Acero"
            ],
            "zones": [
              "Placa base",
              "Perno de anclaje",
              "Otro"
            ]
          }
        ]
      }
    ],
    "damages": [
      {
        "name": "Deterioro",
        "materials": [
          "todos"
        ],
        "severity": [
          "mínima",
          "media",
          "alta",
          "muy alta"
        ]
      },
      {
        "name": "Alteración superficial",
        "materials": [
          "todos"
        ],
        "severity": [
          "se trata de un deterioro de carácter muy superficial, es decir, no se reduce la sección (en caso de un elemento metálico o durmiente), el recubrimiento (elementos de hormigón armado o pretensado) o el volumen (fábrica) o afecta a menos del 50% de la superficie del paramento. Cuando el elemento no pierde sus propiedades básicas, tanto resistentes, como durables o funcionales",
          "se trata de un deterioro de carácter superficial pero se reduce algo la sección (en caso de un elemento metálico, durmientes), el recubrimiento (elementos de hormigón armado o pretensado) o el volumen (fábrica) o afecta a más del 50% de la superficie del paramento. Cuando el elemento ha perdido alguna de sus propiedades básicas, sean estas resistentes, como durables o funcionales.",
          "",
          ""
        ]
      },
      {
        "name": "Armadura a la vista",
        "materials": [
          "todos"
        ],
        "severity": [
          "se trata de armaduras principales puntuales, con pérdidas de sección del diámetro de la barra Cuando están afectadas menos del 10% de las armaduras de una sección del elemento, con oxidación pero sin pérdidas de sección del diámetro de las barras",
          "están afectadas las armaduras de una sección del elemento, con pérdidas de sección completa del diámetro de las barras (rotura), sin que se entienda que existe un riesgo de comportamiento resistente anómalo o caída de fragmentos de hormigón con posibilidad de causar un accidente sobre un usuario (peatón o vehículo)",
          "están afectadas las armaduras de una sección del elemento, con pérdidas de sección completa del diámetro de las barras (rotura), sin que se entienda que existe un riesgo de comportamiento resistente anómalo o caída de fragmentos de hormigón con posibilidad de causar un accidente grave sobre un usuario (peatón o vehículo)",
          "están afectadas las armaduras de una sección del elemento, con pérdidas de sección completa del diámetro de las barras (rotura), existiendo un riesgo de comportamiento resistente anómalo o caída de fragmentos de hormigón con posibilidad de causar un accidente grave sobre un usuario (peatón o vehículo)"
        ]
      },
      {
        "name": "Aterramiento",
        "materials": [
          "todos"
        ],
        "severity": [
          "existe una cierta pérdida de movilidad pero el elemento no pierde sus propiedades funcionales",
          "existe una cierta pérdida de movilidad y el elemento pierde parte de sus propiedades funcionales; este hecho se refleja en deterioros en los elementos en contacto (tablero o cepas y estribos)",
          "existe una completa pérdida de movilidad y el elemento ha perdido por completo sus propiedades funcionales; este hecho se refleja en deterioros en los elementos en contacto (tablero o cepas y estribos)",
          ""
        ]
      },
      {
        "name": "Abolladura",
        "materials": [
          "todos"
        ],
        "severity": [
          "se trata de una abolladura, cuando la deformación es inferior a 1 mm (medido según la profundidad de la chapa abollada)",
          "se trata de una abolladura, cuando la deformación se sitúa entre 1 y 10 mm (medido según la profundidad de la chapa abollada)",
          "se trata de una abolladura, cuando la deformación es superior a 10 mm (medido según la profundidad de la chapa abollada)",
          "la deformación del elemento impide su correcto comportamiento funcional o resistente y la consecuencia es un accidente grave"
        ]
      },
      {
        "name": "Carcavas",
        "materials": [
          "todos"
        ],
        "severity": [
          "afecta a menos de un 25% de la superficie del terraplén o de su enrocado de protección y no entre en contacto con ningún elemento de la estructura",
          "afecta entre un 25% y un 50% de la superficie del terraplén o de su enrocado de protección y entra en contacto con algún elemento de la estructura",
          "afecta a más de un 50% de la superficie del terraplén o de su enrocado de protección y afecta a la estabilidad de algún elemento de la estructura",
          "afecta a más de un 50% de la superficie del terraplén o de su enrocado de protección y se pone en riesgo la estabilidad de algún elemento de la estructura"
        ]
      },
      {
        "name": "Coqueras nidos de grava",
        "materials": [
          "todos"
        ],
        "severity": [
          "afecta a menos del 50% de la superficie del paramento",
          "afecta a más del 50% de la superficie del paramento",
          "",
          ""
        ]
      },
      {
        "name": "Corrosión",
        "materials": [
          "todos"
        ],
        "severity": [
          "está afectada menos del 10% de la superficie del elemento, con oxidación pero sin pérdidas de sección En el caso de uniones, cuando afecta a menos del 10% de la longitud (soldaduras) o número (de tornillos o roblones) del total de la unión, con oxidación pero sin pérdidas de sección",
          "está afectada entre el 10% y el 50% de la superficie del elemento, con oxidación pero sin pérdidas de sección, o en el caso de uniones, cuando afecta entre el 10% y el 50% de la longitud (soldaduras) o número (de tornillos o roblones) del total de la unión, con oxidación pero sin pérdidas de sección",
          "está afectada más del 50% de la superficie del elemento, con pérdidas de sección o cuando afecta a más del 50% de la longitud (soldaduras) o número (de tornillos o roblones) del total de la unión, con pérdidas de sección, sin que se impida el comportamiento resistente o funcional del elemento",
          "está afectada la superficie del elemento, con pérdidas de sección, impidiéndose el adecuado comportamiento resistente o funcional del elemento"
        ]
      },
      {
        "name": "Deformación",
        "materials": [
          "todos"
        ],
        "severity": [
          "se trata de pandeo lateral, cuando el desplazamiento relativo es inferior a 5 mm/m (en el plano perpendicular al eje de mayor dimensión) En el caso de apoyos, cuando la deformación supone que el desplazamiento de la cara superior con respecto a la cara inferior del apoyo (distancia d) es inferior, medido en planta, al 70% de la altura del apoyo (distancia h) En el caso de una estructura completa, la deformación es inferior al 0,10% de la magnitud del elemento (por ejemplo, en un tablero de 40,00 m de luz, implicaría una deformación vertical de 4 cm en su punto máximo), con respecto a su plano teórico",
          "de tratarse de pandeo lateral, cuando el desplazamiento relativo entre 5 y 50 mm/m (en el plano perpendicular al eje de mayor dimensión)",
          "de tratarse de pandeo lateral, cuando el desplazamiento relativo superior a 50 mm/m (en el plano perpendicular al eje de mayor dimensión)",
          "la deformación del elemento impide su correcto comportamiento funcional o resistente y la consecuencia es un accidente grave"
        ]
      },
      {
        "name": "Descalce",
        "materials": [
          "todos"
        ],
        "severity": [
          "no hay otros deterioros asociados (movimiento de la cepa o estribo) y la consecuencia es la visibilidad de los paramentos verticales de la fundación del elemento",
          "hay deterioros leves asociados a otros elementos (movimientos o grietas en cepa o estribo) o  se aprecia parte de la cara inferior de la fundación (-30% cimentación profunda, -10% cimentación superficial)",
          "hay deterioros graves asociados a otros elementos (movimientos o grietas en cepa o estribo) o  se aprecia parte de la cara inferior de la fundación (+30% cimentación profunda, +10% cimentación superficial)",
          "el descalce del elemento impide su correcto comportamiento funcional o resistente y la consecuencia es un accidente grave"
        ]
      },
      {
        "name": "Desconchón sin armadura a la vista",
        "materials": [
          "todos"
        ],
        "severity": [
          "la profundidad del desconchón no supera los 10 mm.",
          "la profundidad del desconchón se encuentra entre los 10 y los 100 mm.",
          "la profundidad del desconchón supera los 100 mm.\nEl elemento afectado ha perdido total o parcialmente su capacidad y hay riesgo de caída de fragmentos con consecuencias graves sobre los usuarios",
          ""
        ]
      },
      {
        "name": "Desconchón con armadura a la vista",
        "materials": [
          "todos"
        ],
        "severity": [
          "Si no se han reducido las propiedades resistentes, aunque lo hayan hecho parcialmente las propiedades durables o funcionales del elemento como consecuencia del deterioro Cuando no hay peligro de caída con riesgo de provocar un accidente",
          "Si no se han reducido las propiedades resistentes, aunque lo hayan hecho parcialmente las propiedades durables o funcionales del elemento como consecuencia del deterioro Cuando hay peligro de caída con riesgo de provocar un accidente leve",
          "Si se han reducido las propiedades resistentes, aunque lo hayan hecho parcialmente (rotura de algunas armaduras pasivas o activas, reducción de la sección de un elemento metálico) Cuando se han reducido de forma notable las propiedades durables o funcionales del elemento como consecuencia del deterioro (por ejemplo, armaduras vistas en más de un 50% de la superficie de un paramento de hormigón armado o pretensado), pero no hay peligro de caída de fragmentos con riesgo de provocar un accidente grave",
          "Si se han reducido las propiedades del elemento (rotura de algunas armaduras pasivas o activas, reducción de la sección de un elemento metálico) poniendo en riesgo el comportamiento resistente del mismo Cuando hay peligro de caída con riesgo de provocar un accidente grave sobre un usuario (peatón o vehículo)"
        ]
      },
      {
        "name": "Fisuras",
        "materials": [
          "todos"
        ],
        "severity": [
          "Fisuras sin incidencia estructural y abertura inferior a 0,4 mm.",
          "Fisuras con incidencia estructural (corte, flexión, compresión) y abertura inferior a 0,4 mm. Otro tipo de fisuras con abertura entre 0,4 mm y 2,0 mm.",
          "Fisuras con incidencia estructural (corte, flexión, compresión) y abertura superior a 0,4 mm. Otro tipo de fisuras con abertura superior a 2,0 mm",
          "Fisuras con incidencia grave en el comportamiento estructural (posibilidad de colapso total o parcial del elemento) No se puede garantizar la estabilidad del elemento y puede producirse un accidente de consecuencias graves sobre los usuarios"
        ]
      },
      {
        "name": "Falta de alineación",
        "materials": [
          "todos"
        ],
        "severity": [
          "la falta de alineación tiene consecuencias exclusivamente estéticas",
          "falta de alineación tiene consecuencias funcionales y se podría provocar algún accidente",
          "",
          ""
        ]
      },
      {
        "name": "Fisuras en mapa o retícula",
        "materials": [
          "todos"
        ],
        "severity": [
          "se trata de fisuras con abertura inferior a 0,4 mm.",
          "se trata de fisuras con abertura entre 0,4 y 2,0 mm.",
          "se trata de fisuras con abertura superior a 2,0 mm.",
          "se trata de fisuras con incidencia grave en el comportamiento estructural (posibilidad de colapso total o parcial del elemento) No se puede garantizar la estabilidad del elemento y puede producirse un accidente de consecuencias graves sobre los usuarios"
        ]
      },
      {
        "name": "Grietas 5mm",
        "materials": [
          "todos"
        ],
        "severity": [
          "se trata de grietas de entre 5 y 10 mm. Estas grietas no provocan un deficiente comportamiento estructural del elemento ni de ningún elemento asociado",
          "se trata de grietas de entre 10 y 25 mm. Estas grietas pueden provocar un deficiente comportamiento estructural del elemento o de algún elemento asociado",
          "se trata de grietas de más de 25 mm. Estas grietas provocan un deficiente comportamiento estructural del elemento o de algún elemento asociado",
          "se trata de grietas con incidencia grave en el comportamiento estructural (posibilidad de colapso total o parcial del elemento) No se puede garantizar la estabilidad del elemento y puede producirse un accidente de consecuencias graves sobre los usuarios"
        ]
      },
      {
        "name": "Humedades",
        "materials": [
          "todos"
        ],
        "severity": [
          "el deterioro no tiene una extensión superior al 50% de la superficie del elemento o no hay otros deterioros de gravedad media o alta asociados (p. ej., armaduras con pérdida de sección)",
          "la extensión es superior al 50% de la superficie del elemento o hay otros deterioros de gravedad media o alta asociados (armaduras con pérdida de sección)",
          "",
          ""
        ]
      },
      {
        "name": "Lajación",
        "materials": [
          "todos"
        ],
        "severity": [
          "no hay peligro de caída con riesgo de provocar un accidente",
          "hay peligro de caída con riesgo de provocar un accidente leve",
          "hay peligro de caída con riesgo de provocar un accidente medio",
          "hay peligro de caída con riesgo de provocar un accidente grave"
        ]
      },
      {
        "name": "Mancha de óxido",
        "materials": [
          "todos"
        ],
        "severity": [
          "la extensión no supera el 50% de la superficie del elemento y no hay otros deterioros de gravedad media o alta asociados",
          "la extensión es superior al 50% de la superficie del elemento o hay otros deterioros de gravedad media o alta asociados",
          "",
          ""
        ]
      },
      {
        "name": "Pérdida de pieza",
        "materials": [
          "todos"
        ],
        "severity": [
          "la pérdida de la pieza tiene unas consecuencias leves o medias sobre el comportamiento funcional del elemento",
          "la pérdida de la pieza tiene unas consecuencias medias o graves sobre el comportamiento funcional del elemento Cuando las consecuencias de la pérdida sobre el comportamiento resistente de la estructura son leves",
          "la pérdida de la pieza tiene unas consecuencias medias sobre el comportamiento resistente del elemento",
          "la pérdida de la pieza tiene unas consecuencias graves sobre el comportamiento resistente del elemento Se aprecian movimientos relativos en los elementos a los que pertenece la pieza y hay peligro de caída de alguno de ellos con riesgo de provocar un accidente grave"
        ]
      },
      {
        "name": "Pérdida de tornillos roblones anclajes",
        "materials": [
          "todos"
        ],
        "severity": [
          "afecta a menos del 5% del número de tornillos o roblones del total de la unión No se aprecian movimientos entre las piezas unidas",
          "afecta entre el 5% y el 20% del número de tornillos o roblones del total de la unión Se aprecian movimientos entre las piezas unidas",
          "se aprecian movimientos entre las piezas unidas y riesgo de accidente por caída del elemento o por impacto de un usuario (vehículo o peatón) con consecuencia de accidente medio",
          "se aprecian movimientos entre las piezas unidas y riesgo de comportamiento estructural anómalo con consecuencias graves o accidente por caída del elemento o por impacto de un usuario (vehículo o peatón) con consecuencia de accidente grave"
        ]
      },
      {
        "name": "Pérdida de tratamiento protector",
        "materials": [
          "todos"
        ],
        "severity": [
          "se trata de un deterioro de carácter superficial que afecta a menos del 50% de la superficie del paramento, sin que aparezcan síntomas de oxidación en el elemento",
          "se trata de un deterioro de carácter superficial que afecta a más del 50% de la superficie del paramento o ya aparecen síntomas de oxidación en el elemento",
          "",
          ""
        ]
      },
      {
        "name": "Pintadas",
        "materials": [
          "todos"
        ],
        "severity": [
          "no tienen más consecuencias que las estéticas en un puente con valor histórico – artístico normal o bajo.",
          "no tienen más consecuencias que las estéticas en un puente con valor histórico – artístico alto.",
          "",
          ""
        ]
      },
      {
        "name": "Rotura",
        "materials": [
          "todos"
        ],
        "severity": [
          "existe rotura parcial de un elemento que no impide su correcto funcionamiento No hay riesgo de caída del elemento afectado",
          "existe rotura parcial de un elemento con consecuencias leves sobre su comportamiento resistente o funcional Hay riesgo de caída del elemento afectado sin riesgo de accidente con víctimas",
          "existe rotura total de un elemento o rotura parcial del mismo, pero tiene consecuencias medias o altas sobre su comportamiento resistente o funcional Cuando hay riesgo de caída del elemento afectado con riesgo de accidente medio",
          "se aprecian movimientos relativos en la pieza rota, llegando a haber partes descolgadas, y hay peligro de caída con riesgo de provocar un accidente grave"
        ]
      },
      {
        "name": "Vegetación",
        "materials": [
          "todos"
        ],
        "severity": [
          "se trata de vegetación no leñosa o vegetación leñosa que no provoca ningún deterioro en el elemento (por ejemplo, desprendimientos en el hormigón, movimiento de piezas de fábrica, etc.)",
          "la vegetación es leñosa y está provocando otros deterioros asociados (por ejemplo, desprendimientos en el hormigón, movimiento de piezas de fábrica, etc.)",
          "",
          ""
        ]
      },
      {
        "name": "Desplazamiento",
        "materials": [
          "todos"
        ],
        "severity": [
          "el desplazamiento no tiene consecuencias sobre el comportamiento resistente o funcional de ninguno de los elementos afectados o el apoyo se encuentra\ndesplazado y ocupa más de un 75% de la posición teórica original",
          "el desplazamiento tiene consecuencias leves o medias sobre el comportamiento resistente o funcional de alguno de los elementos afectados o el apoyo se encuentra\ndesplazado y ocupa entre un 25% y un 75% de la posición teórica original",
          "el desplazamiento tiene consecuencias importantes sobre el comportamiento resistente o funcional de alguno de los elementos afectados o el apoyo se encuentra\ndesplazado y ocupa menos de un 25% de la posición teórica original",
          "el desplazamiento del elemento impide su correcto comportamiento funcional o resistente y la consecuencia es un accidente grave"
        ]
      },
      {
        "name": "Eflorescencias",
        "materials": [
          "todos"
        ],
        "severity": [
          "El deterioro no tiene una extensión superior al 50% de la superficie del elemento o no hay otros deterioros de gravedad media o alta asociados (p. ej., armaduras con pérdida de sección)",
          "La extensión es superior al 50% de la superficie del elemento o hay otros deterioros de gravedad media o alta asociados (armaduras con pérdida de sección)",
          "",
          ""
        ]
      }
    ],
    "causesByDamage": {
      "Alteración superficial": [
        "abrasión por tránsito",
        "acción climática",
        "acción de la fauna",
        "ataque químico",
        "causa desconocida",
        "ciclos hielo-deshielo",
        "envejecimiento",
        "escorrentía superficial",
        "calidad deficiente de la pieza/elemento",
        "mal funcionamiento del sistema de drenaje",
        "pérdida de tratamiento protector",
        "vandalismo",
        "deficiente ejecución"
      ],
      "Armadura a la vista": [
        "causa desconocida",
        "corrosión de las armaduras",
        "deficiente ejecución",
        "escasez de recubrimiento"
      ],
      "Abolladura": [
        "Golpe o Impacto"
      ],
      "Aterramiento": [
        "acción de la fauna",
        "causa desconocida",
        "deficiente ejecución",
        "diseño deficiente",
        "sedimentación por escorrentía superficial",
        "vandalismo",
        "sedimentación orgánica"
      ],
      "Coqueras nidos de grava": [
        "deficiente ejecución"
      ],
      "Carcavas": [
        "acción climática",
        "acción de la fauna",
        "acción sísmica",
        "causa desconocida",
        "deficiente compactación del relleno",
        "deficiente ejecución",
        "escorrentía superficial",
        "mal funcionamiento del sistema de drenaje"
      ],
      "Corrosión": [
        "ataque químico",
        "causa desconocida",
        "corrosión",
        "envejecimiento",
        "falta de protección de anclajes",
        "calidad deficiente de la pieza/elemento",
        "pérdida de tratamiento protector"
      ],
      "Descalce": [
        "acción de la fauna",
        "acción sísmica",
        "causa desconocida",
        "deficiente compactación del relleno",
        "deficiente ejecución",
        "escorrentía superficial",
        "falta de protección",
        "falta de protección frente a avenidas",
        "mal funcionamiento del sistema de drenaje"
      ],
      "Deformación": [
        "abrasión por tránsito",
        "acción sísmica",
        "asiento diferencial",
        "causa desconocida",
        "deficiente ejecución",
        "esfuerzos",
        "esfuerzos (compresión)",
        "golpe o impacto",
        "infradimensionamiento del elemento",
        "presión excesiva de un elemento sobre otro",
        "subestimación de empujes"
      ],
      "Desconchón sin armadura a la vista": [
        "acción sísmica",
        "causa desconocida",
        "deficiente ejecución",
        "golpe o impacto",
        "presión excesiva de un elemento sobre otro"
      ],
      "Desconchón con armadura a la vista": [
        "acción sísmica",
        "causa desconocida",
        "deficiente ejecución",
        "golpe o impacto",
        "presión excesiva de un elemento sobre otro",
        "Corrosión de las armaduras"
      ],
      "Fisuras": [
        "abrasión por tránsito",
        "acción climática",
        "acción sísmica",
        "asiento diferencial",
        "ataque químico",
        "ausencia o deficiente dispositivo de junta",
        "ausencia o deficiente losa de transición",
        "causa desconocida",
        "ciclos hielo-deshielo",
        "corrosión",
        "corrosión de las armaduras",
        "deficiente ejecución",
        "diseño deficiente",
        "escasez de recubrimiento",
        "esfuerzos",
        "esfuerzos (compresión)",
        "esfuerzos (corte)",
        "esfuerzos (flexión)",
        "esfuerzos (torsión)",
        "esfuerzos (tracción)",
        "exceso de compresión",
        "infradimensionamiento del elemento",
        "presión excesiva de un elemento sobre otro",
        "retracción",
        "tensión excesiva en zonas de anclajes"
      ],
      "Fisuras en mapa o retícula": [
        "acción sísmica",
        "ataque químico",
        "acción climática",
        "deficiente ejecución",
        "causa desconocida",
        "ciclos hielo-deshielo",
        "corrosión de las armaduras",
        "escasez de recubrimiento"
      ],
      "Grietas 5mm": [
        "abrasión por tránsito",
        "acción climática",
        "acción sísmica",
        "asiento diferencial",
        "ataque químico",
        "ausencia o deficiente dispositivo de junta",
        "ausencia o deficiente losa de transición",
        "causa desconocida",
        "corrosión de las armaduras",
        "deficiente compactación del relleno",
        "deficiente ejecución",
        "esfuerzos",
        "esfuerzos (compresión)",
        "esfuerzos (corte)",
        "esfuerzos (flexión)",
        "esfuerzos (torsión)",
        "esfuerzos (tracción)",
        "giro",
        "golpe o impacto",
        "infradimensionamiento del elemento",
        "presión excesiva de un elemento sobre otro",
        "tensión excesiva en zonas de anclajes"
      ],
      "Humedades": [
        "ausencia o deficiente dispositivo de junta",
        "caceparidad",
        "causa desconocida",
        "escorrentía superficial",
        "falta de barbacana",
        "impermeabilización defectuosa",
        "mal funcionamiento del sistema de drenaje",
        "rotura de conducción"
      ],
      "Lajación": [
        "causa desconocida",
        "corrosión de las armaduras",
        "golpe o impacto"
      ],
      "Mancha de óxido": [
        "acción climática",
        "ausencia o deficiente dispositivo de junta",
        "caceparidad",
        "causa desconocida",
        "corrosión",
        "corrosión de las armaduras",
        "deficiente ejecución",
        "escorrentía superfiial",
        "falta de barbacana",
        "falta de limpieza del encofrado",
        "impermeabilización defectuosa",
        "mal funcionamiento del sistema de drenaje",
        "vandalismo"
      ],
      "Pérdida de pieza": [
        "abrasión por tránsito",
        "acción de la fauna",
        "acción sísmica",
        "causa desconocida",
        "deficiente ejecución",
        "falta de protección",
        "falta de protección frente a avenidas",
        "golpe o impacto",
        "presión excesiva de un elemento sobre otro",
        "vandalismo"
      ],
      "Pérdida de tornillos roblones anclajes": [
        "abrasión por tránsito",
        "acción climática",
        "acción sísmica",
        "causa desconocida",
        "corrosión",
        "deficiente ejecución",
        "diseño deficiente",
        "esfuerzos",
        "calidad deficiente de la pieza/elemento",
        "golpe o impacto",
        "infradimensionamiento del elemento",
        "movimiento excesivo del tablero",
        "tensión excesiva en zonas de anclajes",
        "vandalismo"
      ],
      "Pérdida de tratamiento protector": [
        "abrasión por tránsito",
        "acción climática",
        "acción de la fauna",
        "ataque químico",
        "causa desconocida",
        "deficiente ejecución",
        "envejecimiento",
        "escorrentía superficial",
        "golpe o impacto",
        "vandalismo",
        "esfuerzos"
      ],
      "Pintadas": [
        "vandalismo"
      ],
      "Rotura": [
        "abrasión por tránsito",
        "acción de la fauna",
        "acción sísmica",
        "ataque químico",
        "causa desconocida",
        "corrosión",
        "deficiente ejecución",
        "escorrentía superficial",
        "esfuerzos",
        "esfuerzos (compresión)",
        "esfuerzos (corte)",
        "esfuerzos (flexión)",
        "esfuerzos (torsión)",
        "esfuerzos (tracción)",
        "falta de protección frente a avenidas",
        "golpe o impacto",
        "infradimensionamiento del elemento",
        "presión excesiva de un elemento sobre otro",
        "rotura de la solera por acción del tránsito",
        "rotura de conducción",
        "subestimación de empujes",
        "tensión excesiva en zonas de anclajes",
        "vandalismo",
        "acción climatica"
      ],
      "Vegetación": [
        "sedimentación orgánica"
      ],
      "Desplazamiento": [
        "abrasión por tránsito",
        "acción climática",
        "acción sísmica",
        "asiento diferencial",
        "ataque químico",
        "ausencia o deficiente dispositivo de junta",
        "ausencia o deficiente losa de transición",
        "causa desconocida",
        "ciclos hielo-deshielo",
        "corrosión",
        "corrosión de las armaduras",
        "deficiente ejecución",
        "diseño deficiente",
        "escasez de recubrimiento",
        "esfuerzos",
        "esfuerzos (compresión)",
        "esfuerzos (corte)",
        "esfuerzos (flexión)",
        "esfuerzos (torsión)",
        "esfuerzos (tracción)",
        "exceso de compresión",
        "infradimensionamiento del elemento",
        "presión excesiva de un elemento sobre otro",
        "retracción",
        "tensión excesiva en zonas de anclajes"
      ],
      "Eflorescencias": [
        "caceparidad",
        "causa desconocida",
        "escorrentía superficial",
        "falta de barbacana",
        "impermeabilización defectuosa",
        "mal funcionamiento del sistema de drenaje"
      ]
    }
  }
}
