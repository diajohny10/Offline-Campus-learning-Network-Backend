const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'campusnet_db.json');

class Database {
  constructor() {
    this.data = {
      students: [
        { id: 'CS2026-001', name: 'Alice Smith', section: 'CS Sec A', password: 'student123' },
        { id: 'CS2026-002', name: 'Bob Martin', section: 'CS Sec A', password: 'student123' },
        { id: 'CS2026-003', name: 'Charlie Davis', section: 'CS Sec B', password: 'student123' },
        { id: 'CS2026-004', name: 'Diana Prince', section: 'CS Sec A', password: 'student123' }
      ],
      resources: [
        { id: 1, name: 'Module 1 Notes.pdf', subject: 'CN', uploadedBy: 'Teacher CN', date: '2025-05-12', size: '2.4 MB', filename: 'sample_cn1.pdf' },
        { id: 2, name: 'Network Topologies.pdf', subject: 'CN', uploadedBy: 'Teacher CN', date: '2025-05-13', size: '1.8 MB', filename: 'sample_cn2.pdf' },
        { id: 3, name: 'OSI Model.pdf', subject: 'CN', uploadedBy: 'Teacher CN', date: '2025-05-14', size: '1.3 MB', filename: 'sample_cn3.pdf' },
        { id: 4, name: 'Binary Trees & Graphs.pdf', subject: 'DS', uploadedBy: 'Teacher DS', date: '2025-05-10', size: '3.1 MB', filename: 'sample_ds1.pdf' },
        { id: 5, name: 'Sorting Algorithms.pdf', subject: 'DS', uploadedBy: 'Teacher DS', date: '2025-05-11', size: '2.0 MB', filename: 'sample_ds2.pdf' },
        { id: 6, name: 'SQL & Normalization.pdf', subject: 'DMS', uploadedBy: 'Teacher DMS', date: '2025-05-08', size: '4.5 MB', filename: 'sample_dms1.pdf' },
        { id: 7, name: 'Macroeconomics Overview.pdf', subject: 'ECON', uploadedBy: 'Teacher ECON', date: '2025-05-05', size: '1.9 MB', filename: 'sample_econ1.pdf' },
        { id: 8, name: 'Human Values & Ethics.pdf', subject: 'UHV', uploadedBy: 'Teacher UHV', date: '2025-05-01', size: '1.1 MB', filename: 'sample_uhv1.pdf' },
        { id: 9, name: 'CPU Pipeline & Cache.pdf', subject: 'COA', uploadedBy: 'Teacher COA', date: '2025-05-02', size: '2.8 MB', filename: 'sample_coa1.pdf' }
      ],
      transfers: [
        { id: 101, from: 'Alice Smith', to: 'Bob Martin', type: 'student_to_student', fileName: 'project_draft.pdf', date: '10:31:12', timestamp: '2026-09-07 10:31:12' },
        { id: 102, from: 'Alice Smith', to: 'Teacher CN', type: 'student_to_teacher', subject: 'CN', fileName: 'assignment1_final.pdf', date: '10:34:08', timestamp: '2026-09-07 10:34:08' },
        { id: 103, from: 'Teacher CN', to: 'All Students (CN)', type: 'upload_by_teacher', subject: 'CN', fileName: 'Module 1 Notes.pdf', date: '10:36:21', timestamp: '2026-09-07 10:36:21' }
      ]
    };

    this.init();
  }

  init() {
    if (fs.existsSync(DB_PATH)) {
      try {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('Error loading database file, using defaults:', err.message);
        this.save();
      }
    } else {
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving database:', err.message);
    }
  }

  // --- STUDENTS API ---
  getStudents() {
    return this.data.students;
  }

  findStudentByName(name) {
    return this.data.students.find(s => s.name.toLowerCase() === name.toLowerCase());
  }

  addStudent(student) {
    this.data.students.push(student);
    this.save();
    return student;
  }

  // --- RESOURCES API ---
  getResources(subject = null) {
    if (subject && subject !== 'ALL') {
      return this.data.resources.filter(r => r.subject.toUpperCase() === subject.toUpperCase());
    }
    return this.data.resources;
  }

  addResource(resource) {
    this.data.resources.unshift(resource);
    this.save();
    return resource;
  }

  deleteResource(id, teacherSubject) {
    const resource = this.data.resources.find(r => r.id === parseInt(id));
    if (!resource) {
      throw new Error('Resource not found');
    }
    if (resource.subject.toUpperCase() !== teacherSubject.toUpperCase()) {
      throw new Error(`Permission Denied: Teacher ${teacherSubject} can only delete files for ${teacherSubject}`);
    }

    this.data.resources = this.data.resources.filter(r => r.id !== parseInt(id));
    this.save();
    return resource;
  }

  // --- TRANSFERS API ---
  getTransfers() {
    return this.data.transfers;
  }

  getUserTransfers(userName) {
    return this.data.transfers.filter(t => 
      t.from.toLowerCase() === userName.toLowerCase() || 
      t.to.toLowerCase() === userName.toLowerCase()
    );
  }

  addTransfer(transfer) {
    this.data.transfers.unshift(transfer);
    this.save();
    return transfer;
  }
}

module.exports = new Database();
