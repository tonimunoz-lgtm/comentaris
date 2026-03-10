// classroom.js - Integración con Google Classroom usando REST API

const CLASSROOM_CLIENT_ID = "324570393360-2ib4925pbobfbggu8t0nnj14q5n414nv.apps.googleusercontent.com"; // Reemplaza con tu ID
const CLASSROOM_DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/classroom/v1/rest"
];

let classroomAccessToken = null;

// Inicializar autenticación con Google usando Google Sign-In
export function initClassroomAPI() {
  return new Promise((resolve, reject) => {
    console.log('📚 Inicializando Classroom API con GIS...');

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLASSROOM_CLIENT_ID,
        scope: [
          "https://www.googleapis.com/auth/classroom.courses.readonly",
          "https://www.googleapis.com/auth/classroom.rosters.readonly",
          "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
          "https://www.googleapis.com/auth/classroom.coursework.students",
          "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly"
        ].join(' '),
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            classroomAccessToken = tokenResponse.access_token;
            window._googleAccessToken = classroomAccessToken;
            console.log('✅ Token obtenido con éxito');
            resolve(true);
          } else {
            reject(new Error('No se obtuvo token de Google Classroom'));
          }
        }
      });

      client.requestAccessToken();

    } catch (err) {
      console.error('❌ Error inicializando Google Classroom:', err);
      reject(err);
    }
  });
}

// Obtener lista de cursos
export async function getClassroomCourses() {
  if (!classroomAccessToken) throw new Error('No hay token de autenticación');

  try {
    console.log('📚 Obteniendo cursos...');
    const response = await fetch(
      'https://classroom.googleapis.com/v1/courses?pageSize=50&courseStates=ACTIVE',
      { headers: { 'Authorization': `Bearer ${classroomAccessToken}`, 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error de API:', errorData);
      throw new Error(errorData.error?.message || 'Error obteniendo cursos');
    }

    const data = await response.json();
    console.log(`✅ Se encontraron ${data.courses?.length || 0} cursos`);
    return data.courses || [];

  } catch (err) {
    console.error('Error obteniendo cursos:', err);
    throw new Error('No se pudieron obtener los cursos de Classroom: ' + err.message);
  }
}

// Obtener estudiantes de un curso
export async function getClassroomStudents(courseId) {
  if (!classroomAccessToken) throw new Error('No hay token de autenticación');

  try {
    console.log(`👥 Obteniendo estudiantes del curso ${courseId}...`);
    const response = await fetch(
      `https://classroom.googleapis.com/v1/courses/${courseId}/students?pageSize=100`,
      { headers: { 'Authorization': `Bearer ${classroomAccessToken}`, 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error obteniendo estudiantes');
    }

    const data = await response.json();
    console.log(`✅ Se encontraron ${data.students?.length || 0} estudiantes`);

    // Asignar valores por defecto si email o nom son undefined
    return (data.students || []).map(student => ({
      id: student.userId,
      email: student.profile.emailAddress || 'No disponible',
      nom: student.profile.name.fullName || 'Sin nombre'
    }));

  } catch (err) {
    console.error('Error obteniendo estudiantes:', err);
    throw new Error('No se pudieron obtener los estudiantes: ' + err.message);
  }
}

// Obtener actividades del curso
export async function getClassroomCoursework(courseId) {
  if (!classroomAccessToken) throw new Error('No hay token de autenticación');

  try {
    console.log(`📝 Obteniendo actividades del curso ${courseId}...`);
    const response = await fetch(
      `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork?pageSize=100&courseWorkStates=PUBLISHED`,
      { headers: { 'Authorization': `Bearer ${classroomAccessToken}`, 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error obteniendo actividades');
    }

    const data = await response.json();
    console.log(`✅ Se encontraron ${data.courseWork?.length || 0} actividades`);

    return (data.courseWork || []).map(work => ({
      id: work.id,
      title: work.title,
      description: work.description || '',
      dueDate: work.dueDate || null,
      maxPoints: work.maxPoints || 10
    }));

  } catch (err) {
    console.error('Error obteniendo actividades:', err);
    throw new Error('No se pudieron obtener las actividades: ' + err.message);
  }
}

// Obtener calificaciones de un alumno en una actividad
export async function getStudentSubmissions(courseId, courseWorkId) {
  if (!classroomAccessToken) throw new Error('No hay token de autenticación');

  try {
    console.log(`📊 Obteniendo calificaciones para actividad ${courseWorkId}...`);
    const response = await fetch(
      `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions?pageSize=100`,
      { headers: { 'Authorization': `Bearer ${classroomAccessToken}`, 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.warn('Advertencia obteniendo calificaciones:', errorData.error?.message);
      return {};
    }

    const data = await response.json();
    const submissions = {};
    (data.studentSubmissions || []).forEach(submission => {
      const grade = submission.assignedGrade || null;
      submissions[submission.userId] = grade !== undefined && grade !== null ? Number(grade) : null;
    });

    console.log(`✅ Se encontraron calificaciones para ${Object.keys(submissions).length} estudiantes`);
    return submissions;

  } catch (err) {
    console.error('Error obteniendo calificaciones:', err);
    return {};
  }
}

// Importar un curso completo
export async function importClassroomCourse(courseData, db, professorUID) {
  try {
    console.log('📚 Iniciando importación de:', courseData.name);

    const classRef = db.collection('classes').doc();
    const classId = classRef.id;

    const students = await getClassroomStudents(courseData.id);
    console.log(`👥 Se encontraron ${students.length} estudiantes`);

    const courseworks = await getClassroomCoursework(courseData.id);
    console.log(`📝 Se encontraron ${courseworks.length} actividades`);

    // Crear documentos de estudiantes con valores por defecto
    const studentIds = [];
    const batch = db.batch();
    for (const student of students) {
      const studentRef = db.collection('alumnes').doc();
      studentIds.push(studentRef.id);

      batch.set(studentRef, {
        nom: student.nom || 'Sin nombre',
        email: student.email || 'No disponible',
        notes: {},
        googleClassroomId: student.id,
        comentarios: {}
      });
    }
    await batch.commit();
    console.log('✅ Estudiantes creados');

    // Crear actividades y obtener calificaciones
    const activityIds = [];
    const notesData = {};
    for (const coursework of courseworks) {
      const actRef = db.collection('activitats').doc();
      const actId = actRef.id;
      activityIds.push(actId);

      await actRef.set({
        nom: coursework.title,
        description: coursework.description,
        data: coursework.dueDate || new Date().toISOString().split('T')[0],
        calcType: 'numeric',
        formula: '',
        googleClassroomId: coursework.id,
        maxPoints: coursework.maxPoints
      });

      const submissions = await getStudentSubmissions(courseData.id, coursework.id);
      notesData[actId] = submissions;
    }
    console.log('✅ Actividades creadas');

    // Guardar calificaciones
    const updateBatch = db.batch();
    for (let i = 0; i < studentIds.length; i++) {
      const studentRef = db.collection('alumnes').doc(studentIds[i]);
      const studentNotes = {};

      for (const [actId, submissions] of Object.entries(notesData)) {
        const googleStudentId = students[i].id;
        if (submissions[googleStudentId] !== undefined && submissions[googleStudentId] !== null) {
          studentNotes[actId] = submissions[googleStudentId];
        }
      }

      updateBatch.update(studentRef, { notes: studentNotes });
    }
    await updateBatch.commit();
    console.log('✅ Calificaciones importadas');

    // Crear la clase con todos los datos
    await classRef.set({
      nom: courseData.name,
      alumnes: studentIds,
      activitats: activityIds,
      terms: {
        'imported': {
          name: 'Importado de Classroom',
          activities: activityIds
        }
      },
      calculatedActivities: {},
      googleClassroomId: courseData.id,
      importedAt: new Date().toISOString()
    });

    await db.collection('professors').doc(professorUID).update({
      classes: firebase.firestore.FieldValue.arrayUnion(classId)
    });

    console.log('✅ Clase importada correctamente');
    return classId;

  } catch (err) {
    console.error('❌ Error importando curso:', err);
    throw new Error('Error importando curso: ' + err.message);
  }
}

// Logout de Classroom
export async function signOutClassroom() {
  try {
    if (gapi && gapi.auth2) {
      const auth2 = gapi.auth2.getAuthInstance();
      if (auth2) {
        await auth2.signOut();
        classroomAccessToken = null;
        console.log('✅ Sesión de Classroom cerrada');
      }
    }
  } catch (err) {
    console.error('Error en logout:', err);
  }
}
