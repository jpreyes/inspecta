/// <reference path="../pb_data/types.d.ts" />
// Devuelve a su equipo los registros que se quedaron sin él.
//
// Síntoma con el que se descubrió: al agregar un CLIENTE al equipo CIC Máfil,
// el cliente veía el equipo y cuatro hallazgos sueltos, pero CERO proyectos,
// estructuras y campañas. O sea: la app no le mostraba nada, porque sin
// estructura no hay dónde colgar un hallazgo.
//
// Causa: las reglas de lectura son
//   `owner = @request.auth.id || (es miembro del equipo DEL REGISTRO)`,
// y el proyecto, la estructura y la campaña de CIC Máfil tenían `team = ''`.
// Se crearon en un dispositivo que no tenía equipo activo (`activeTeamId` sale
// de localStorage y el equipo se creó después), y como el push manda el
// registro entero en cada sincronización, ese `team: ''` se lo iba escribiendo
// encima al servidor una y otra vez. Los hallazgos sí lo tenían porque los
// registró la inspectora, con el equipo ya elegido.
//
// El agujero de raíz se tapó en el cliente (`backend.push` ya no manda `team`
// ni `author` vacíos al ACTUALIZAR: un campo ausente en un PATCH deja lo del
// servidor intacto). Esta migración arregla los datos que ya estaban mal.
//
// Criterio, deliberadamente conservador: a un registro sin equipo se le pone el
// equipo de la ESTRUCTURA a la que pertenece —o, para proyectos y estructuras,
// el que tengan sus propios hallazgos—, y solo si ese equipo es uno solo y no
// hay ambigüedad. Nunca se le quita el equipo a nadie ni se toca un registro
// que ya tenga uno.
migrate(
  (app) => {
    /** Equipo (único) de una lista de registros; '' si no hay o hay varios. */
    const equipoComun = (registros) => {
      const equipos = new Set(registros.map((r) => r.getString('team')).filter(Boolean))
      return equipos.size === 1 ? [...equipos][0] : ''
    }
    // Límite explícito: `0` no siempre significa "sin límite" y quedarse corto
    // acá dejaría registros a medio arreglar. 500 sobra para esta base.
    const todos = (col, filtro) => app.findRecordsByFilter(col, filtro, '', 500, 0)

    let tocados = 0
    const asignar = (registro, team) => {
      if (!team || registro.getString('team')) return
      registro.set('team', team)
      app.save(registro)
      tocados++
    }

    // ── 1. Campañas: heredan el equipo de su estructura, y si la estructura
    //       tampoco lo tiene, el de sus propios hallazgos.
    for (const insp of todos('inspections', 'team = ""')) {
      let team = ''
      try {
        team = app.findRecordById('structures', insp.getString('structure')).getString('team')
      } catch (e) {
        team = ''
      }
      if (!team) {
        team = equipoComun(todos('findings', `inspection = "${insp.id}"`))
      }
      asignar(insp, team)
    }

    // ── 2. Estructuras: el equipo de sus campañas.
    for (const st of todos('structures', 'team = ""')) {
      asignar(st, equipoComun(todos('inspections', `structure = "${st.id}"`)))
    }

    // ── 3. Proyectos: el equipo de sus estructuras.
    for (const pr of todos('projects', 'team = ""')) {
      asignar(pr, equipoComun(todos('structures', `project = "${pr.id}"`)))
    }

    // ── 4. Ensayos: el de su campaña (por completitud; se registran igual que
    //       los hallazgos, pero pueden venir de un dispositivo sin equipo).
    for (const t of todos('tests', 'team = ""')) {
      let team = ''
      try {
        team = app.findRecordById('inspections', t.getString('inspection')).getString('team')
      } catch (e) {
        team = ''
      }
      asignar(t, team)
    }

    // Sin `console.log` a propósito: si algo del JSVM falla acá, la migración
    // no corre y PocketBase no arranca. El resultado se comprueba desde fuera.
  },
  (app) => {
    // No se revierte: dejar registros sin equipo es justamente el estado roto
    // —el trabajo desaparece para todo el equipo menos para su dueño.
  },
)
