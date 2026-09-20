const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const PORT = process.env.PORT || 5000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Utility: Send JSON Response with CORS
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
  });
  res.end(JSON.stringify(data));
}

// Utility: Parse JSON Request Body gracefully
function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve(null); // Return null on JSON parse failure
      }
    });
    req.on('error', () => resolve(null));
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight Handler
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // ----------------------------------------------------
    // AUTH ROUTES
    // ----------------------------------------------------
    if (pathname === '/api/auth/teacher-login' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body) return sendJson(res, 400, { success: false, message: 'Invalid JSON payload' });

      const { subjectCode, password } = body;

      if (!subjectCode) {
        return sendJson(res, 400, { success: false, message: 'Subject Code is required' });
      }

      if (password !== 'teacher123') {
        return sendJson(res, 401, { success: false, message: 'Invalid Password. (Use teacher123)' });
      }

      return sendJson(res, 200, {
        success: true,
        message: 'Teacher authenticated successfully',
        user: {
          role: 'teacher',
          name: `Teacher ${subjectCode}`,
          subjectCode: subjectCode
        }
      });
    }

    if (pathname === '/api/auth/student-login' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body) return sendJson(res, 400, { success: false, message: 'Invalid JSON payload' });

      const { name, password } = body;

      if (!name || !password) {
        return sendJson(res, 400, { success: false, message: 'Student Name and Password are required' });
      }

      const student = db.findStudentByName(name);
      if (!student) {
        return sendJson(res, 404, { success: false, message: `Student "${name}" is not registered. Please ask your teacher to register you!` });
      }

      if (student.password !== password) {
        return sendJson(res, 401, { success: false, message: 'Incorrect password for registered student.' });
      }

      return sendJson(res, 200, {
        success: true,
        message: 'Student authenticated successfully',
        user: {
          role: 'student',
          name: student.name,
          studentId: student.id,
          section: student.section
        }
      });
    }

    // ----------------------------------------------------
    // STUDENT REGISTRATION ROUTES
    // ----------------------------------------------------
    if (pathname === '/api/students' && method === 'GET') {
      return sendJson(res, 200, { success: true, students: db.getStudents() });
    }

    if (pathname === '/api/students/register' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body) return sendJson(res, 400, { success: false, message: 'Invalid JSON payload' });

      const { name, studentId, section, password, teacherSubject } = body;

      if (!name || !studentId) {
        return sendJson(res, 400, { success: false, message: 'Student Name and ID are required' });
      }

      const existing = db.getStudents().find(s => s.id.toLowerCase() === studentId.toLowerCase());
      if (existing) {
        return sendJson(res, 409, { success: false, message: `Student ID "${studentId}" is already registered!` });
      }

      const newStudent = db.addStudent({
        id: studentId,
        name: name,
        section: section || 'CS Sec A',
        password: password || 'student123'
      });

      db.addTransfer({
        id: Date.now(),
        from: `Teacher ${teacherSubject || 'CN'}`,
        to: name,
        type: 'student_registered',
        subject: teacherSubject || 'CN',
        fileName: `ID: ${studentId}`,
        date: new Date().toLocaleTimeString(),
        timestamp: new Date().toLocaleString()
      });

      return sendJson(res, 201, { success: true, message: 'Student registered successfully', student: newStudent });
    }

    // ----------------------------------------------------
    // SUBJECT RESOURCES ROUTES
    // ----------------------------------------------------
    if (pathname === '/api/resources' && method === 'GET') {
      const subject = parsedUrl.searchParams.get('subject');
      const resources = db.getResources(subject);
      return sendJson(res, 200, { success: true, resources: resources });
    }

    if (pathname === '/api/resources/upload' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body) return sendJson(res, 400, { success: false, message: 'Invalid JSON payload' });

      const { title, subject, size, fileContent, teacherSubject } = body;

      if (!title || !subject) {
        return sendJson(res, 400, { success: false, message: 'Title and Subject Code are required' });
      }

      // Enforce subject lock check
      if (teacherSubject && teacherSubject.toUpperCase() !== subject.toUpperCase()) {
        return sendJson(res, 403, { success: false, message: `Permission Denied: Teacher ${teacherSubject} can only upload to ${teacherSubject}!` });
      }

      const fileId = Date.now();
      const safeFilename = `${subject}_${fileId}_${title.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = path.join(UPLOADS_DIR, safeFilename);

      fs.writeFileSync(filePath, fileContent || `Sample study content for ${title}`);

      const newResource = db.addResource({
        id: fileId,
        name: title,
        subject: subject.toUpperCase(),
        uploadedBy: `Teacher ${subject.toUpperCase()}`,
        date: new Date().toISOString().split('T')[0],
        size: size || '2.4 MB',
        filename: safeFilename
      });

      db.addTransfer({
        id: Date.now() + 1,
        from: `Teacher ${subject.toUpperCase()}`,
        to: `All Students (${subject.toUpperCase()})`,
        type: 'upload_by_teacher',
        subject: subject.toUpperCase(),
        fileName: title,
        date: new Date().toLocaleTimeString(),
        timestamp: new Date().toLocaleString()
      });

      return sendJson(res, 201, { success: true, message: 'Resource uploaded successfully', resource: newResource });
    }

    if (pathname.startsWith('/api/resources/') && method === 'DELETE') {
      const resourceId = pathname.split('/')[3];
      const teacherSubject = parsedUrl.searchParams.get('teacherSubject') || 'CN';

      try {
        const deleted = db.deleteResource(resourceId, teacherSubject);
        return sendJson(res, 200, { success: true, message: 'Resource deleted', resource: deleted });
      } catch (err) {
        return sendJson(res, 403, { success: false, message: err.message });
      }
    }

    // ----------------------------------------------------
    // TRANSFERS & NOTIFICATIONS ROUTES
    // ----------------------------------------------------
    if (pathname === '/api/transfers' && method === 'GET') {
      return sendJson(res, 200, { success: true, transfers: db.getTransfers() });
    }

    if (pathname === '/api/transfers/my-transfers' && method === 'GET') {
      const userName = parsedUrl.searchParams.get('user');
      if (!userName) {
        return sendJson(res, 400, { success: false, message: 'user query param required' });
      }
      return sendJson(res, 200, { success: true, transfers: db.getUserTransfers(userName) });
    }

    if (pathname === '/api/transfers' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body) return sendJson(res, 400, { success: false, message: 'Invalid JSON payload' });

      const { from, to, type, subject, fileName } = body;

      if (!from || !to || !fileName) {
        return sendJson(res, 400, { success: false, message: 'From, To, and File Name are required' });
      }

      const transfer = db.addTransfer({
        id: Date.now(),
        from: from,
        to: to,
        type: type || 'student_to_student',
        subject: subject || null,
        fileName: fileName,
        date: new Date().toLocaleTimeString(),
        timestamp: new Date().toLocaleString()
      });

      return sendJson(res, 201, { success: true, message: 'Transfer recorded', transfer: transfer });
    }

    // ----------------------------------------------------
    // STATIC FILE DOWNLOAD ROUTE (/uploads/:filename)
    // ----------------------------------------------------
    if (pathname.startsWith('/uploads/') && method === 'GET') {
      const filename = path.basename(pathname);
      const filePath = path.join(UPLOADS_DIR, filename);

      if (fs.existsSync(filePath)) {
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      } else {
        return sendJson(res, 404, { success: false, message: 'File not found on server' });
      }
    }

    // Default 404
    sendJson(res, 404, { success: false, message: 'API Endpoint Not Found' });

  } catch (error) {
    console.error('Server error:', error);
    sendJson(res, 500, { success: false, message: 'Internal Server Error', error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 CampusLink REST API Server running on port ${PORT}`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`📁 Uploads Directory: ${UPLOADS_DIR}`);
  console.log(`====================================================`);
});
