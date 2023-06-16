// 1.- Invocamos a express
const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();
const Swal = require('sweetalert2');
const fs = require('fs');
const slugify = require('slugify');
const ExcelJS = require('exceljs');
const mysql = require('mysql');
const autenticar = require('./routes/autenticar'); 

const storage = multer.diskStorage({
  destination: 'public/uploads',
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const storage2 = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'archivo') {
      cb(null, 'public/pdf');
    } else if (file.fieldname === 'avatar') {
      cb(null, 'public/uploads');
    }
  },
  filename: function (req, file, cb) {
    const originalName = decodeURIComponent(file.originalname);
    const extension = path.extname(originalName);
    const fileNameWithoutExtension = path.basename(originalName, extension);
    const slugifiedName = slugify(fileNameWithoutExtension, { lower: true });
    const finalFileName = `${slugifiedName}${extension}`;
    cb(null, finalFileName);
  }
});

const upload = multer({ storage });
const upload2 = multer({ storage: storage2 });

// Crea el directorio uploads si no existe
const dir = './public/pdf/';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}


// 2.- Seteamos urlencoded para capturar los datos del formulario y no nos de error
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// 3.- Invocamos a dotenv (manejador de las variables de entorno)
const dotenv = require('dotenv');
dotenv.config({ path: './env/.env' });

// 4.- Configurar el directorio public (en public se ponen los archivos css, js e imágenes)
app.use('/resources', express.static('public'));
app.use('/resources/uploads', express.static('public/uploads'));
app.use('/resources', express.static(__dirname + '/public'));


// 5.- Estableciendo el motor de plantillas
app.set('view engine', 'ejs');

// 6.- Invocamos a bcrypjs
const bcryptjs = require('bcryptjs');

// 7.- Variables de sesión
const session = require('express-session');
app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}));

// 8.- Invocamos al módulo de la conexión de la BD
const connection = require('./database/db');

// aqui agregue el codigo para la base de datos 2

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'events',
});

db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log('Conexión establecida con la base de datos MySQL');
});

app.get('/', (req, res) => {
  if (req.session.loggedin) {
      let backgroundImage = backgrounds[req.path];
      let login = req.session.loggedin;
      let name = req.session.name;
      const avatar = req.session.avatar; // Obtén el avatar de la sesión
      res.render('index', { backgroundImage, login, name, avatar }); // Pasa el avatar al contexto de la plantilla
  }else {
      res.redirect('/login'); // Redirige al formulario de inicio de sesión si no ha iniciado sesión
  }
});

app.post('/pdf/', upload2.single('archivo'), function (req, res) {
  res.redirect('/recursos');
});

app.post('/upload', upload.single('avatar'), (req, res) => {
  req.session.avatar = req.file ? req.file.filename : req.session.avatar; // Actualiza el avatar solo si se cargó un archivo
  res.redirect('/');
});

app.get('/login', (req, res) => {
  let backgroundImage = backgrounds[req.path];
  res.render('login', { backgroundImage });
});

app.get('/register', (req, res) => {
  let backgroundImage = backgrounds[req.path];
  res.render('register', { backgroundImage });
});

app.get('/agenda', (req, res) => {
  if (req.session.loggedin) {
    let backgroundImage = backgrounds[req.path];
    let login = req.session.loggedin;
    let name = req.session.name;
    const avatar = req.session.avatar; // Obtén el avatar de la sesión

    db.query('SELECT * FROM events', (err, result) => {
      if (err) {
        throw err;
      }
      const eventos = result.map((evento) => {
        const fecha = new Date(evento.fecha);
        return { ...evento, fecha };
      });

      res.render('agenda', { backgroundImage, login, name, avatar, eventos, error: req.query.error });
    });
  } else {
    res.redirect('/login'); // Redirige al formulario de inicio de sesión si no ha iniciado sesión
  }
});

app.post('/agregar-evento', (req, res) => {
  const evento = {
    modulo: req.body.modulo,
    tema: req.body.tema,
    profesor: req.body.profesor,
    hora: req.body.hora,
    fecha: req.body.fecha,
  };

  db.query('INSERT INTO events SET ?', evento, (err) => {
    if (err) {
      throw err;
    }
    res.redirect('/agenda');
  });
});

app.post('/guardar-edicion/:id', (req, res) => {
  const eventId = req.params.id;
  const evento = {
    modulo: req.body.modulo,
    tema: req.body.tema,
    profesor: req.body.profesor,
    hora: req.body.hora,
    fecha: req.body[`fecha_${eventId}`], // Obtén el valor del campo de fecha correspondiente al ID del evento
  };

  if (!evento.fecha || evento.fecha.trim() === '') {
    // Si la fecha no está presente o está vacía, redirigir a la página principal con un mensaje de error
    res.redirect('/agenda?error=missing_date');
    return;
  }

  db.query('UPDATE events SET ? WHERE id = ?', [evento, eventId], (err) => {
    if (err) {
      throw err;
    }
    res.redirect('/agenda');
  });
});

app.get('/eliminar-evento/:id', (req, res) => {
  const eventId = req.params.id;
  db.query('DELETE FROM events WHERE id = ?', eventId, (err) => {
    if (err) {
      throw err;
    }
    res.redirect('/agenda');
  });
});

app.get('/exportar-excel', (req, res) => {
  db.query('SELECT * FROM events', (err, result) => {
    if (err) {
      throw err;
    }
    const eventos = result.map((evento) => {
      const fecha = new Date(evento.fecha);
      return { ...evento, fecha };
    });

    generarArchivoExcel(eventos)
      .then((filePath) => {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=eventos.xlsx');
        fs.createReadStream(filePath).pipe(res);
      })
      .catch((err) => {
        throw err;
      });
  });
});
function generarArchivoExcel(eventos) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Eventos');

  worksheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Módulo', key: 'modulo', width: 20 },
    { header: 'Tema', key: 'tema', width: 30 },
    { header: 'Profesor', key: 'profesor', width: 30 },
    { header: 'Hora', key: 'hora', width: 15 },
    { header: 'Fecha', key: 'fecha', width: 20, style: { numFmt: 'yyyy-mm-dd' } },
  ];

  eventos.forEach((evento) => {
    worksheet.addRow(evento);
  });

  const filePath = path.join(__dirname, 'eventos.xlsx');

  return workbook.xlsx.writeFile(filePath).then(() => {
    return filePath;
  });
}
app.get('/descargar-pdf', (req, res) => {
  db.query('SELECT * FROM events', (err, result) => {
    if (err) {
      throw err;
    }
    const eventos = result.map((evento) => {
      const fecha = new Date(evento.fecha);
      return { ...evento, fecha };
    });

    generarArchivoPDF(eventos)
      .then((filePath) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=eventos.pdf');
        fs.createReadStream(filePath).pipe(res);
      })
      .catch((err) => {
        throw err;
      });
  });
});

function generarArchivoPDF(eventos) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument();

  // Generar el contenido del PDF
  doc.font('Helvetica-Bold').fontSize(24).text('Calendario de Eventos', { align: 'center' });
  doc.moveDown();

  eventos.forEach((evento) => {
    doc.font('Helvetica').fontSize(12).text(`Módulo: ${evento.modulo}`);
    doc.font('Helvetica').fontSize(12).text(`Tema: ${evento.tema}`);
    doc.font('Helvetica').fontSize(12).text(`Profesor: ${evento.profesor}`);
    doc.font('Helvetica').fontSize(12).text(`Hora: ${evento.hora}`);
    doc.font('Helvetica').fontSize(12).text(`Fecha: ${evento.fecha.toLocaleDateString('es-ES')}`);
    doc.moveDown();
  });

  const filePath = path.join(__dirname, 'eventos.pdf');

  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.end();

    stream.on('finish', () => {
      resolve(filePath);
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
}

app.get('/recursos', function(req, res) {
  if (req.session.loggedin) {
    let backgroundImage = backgrounds[req.path];
    let login = req.session.loggedin;
    let name = req.session.name;
    
    // Obtener la lista de archivos en el directorio 'public/pdf/'
    fs.readdir('public/pdf/', (err, archivos) => {
      if (err) {
        console.log(err);
        archivos = [];
      }

      const avatar = req.session.avatar; // Obtén el avatar de la sesión
      res.render('recursos', { backgroundImage, login, name, avatar, archivos: archivos }); // Pasa el avatar y los archivos al contexto de la plantilla
    });
  } else {
    res.redirect('/login'); // Redirige al formulario de inicio de sesión si no ha iniciado sesión
  }
});

// Ruta para descargar el archivo
app.get('/download/:archivo', function (req, res) {
  const archivo = req.params.archivo;
  const rutaArchivo = path.join(__dirname, 'public/pdf', archivo);
  res.download(rutaArchivo);
});

app.post('/delete-pdf', (req, res) => {
  const archivo = req.body.archivo;
  const rutaArchivo = path.join(__dirname, 'public/pdf', archivo);

  // Verificar si el archivo existe antes de eliminarlo
  if (fs.existsSync(rutaArchivo)) {
    fs.unlinkSync(rutaArchivo); // Eliminar el archivo

    // Redirigir a la página de recursos después de eliminar el archivo
    res.redirect('/recursos');
  } else {
    res.status(404).send('El archivo no existe.');
  }
});

 // 10.- Registro
 app.post('/register', upload.single('avatar'), async (req, res) => {
  const user = req.body.user;
  const name = req.body.name;
  const email = req.body.email;
  const pass = req.body.pass;
  let passwordHash = await bcryptjs.hash(pass, 8);

  let avatar = req.session.avatar;
  if (req.file) {
    avatar = req.file.filename;
  }

  // Verificar si avatar es nulo y proporcionar un valor predeterminado
  if (!avatar) {
    avatar = 'default-avatar.jpg'; 
  }

  connection.query(
    'INSERT INTO users SET ?',
    { user: user, name: name, email: email, pass: passwordHash, avatar: avatar },
    async (error, results) => {
      if (error) {
        console.log(error);
      } else {
        req.session.avatar = avatar;
        res.render('register', {
          backgroundImage: 'resources/images/fondoRegister.JPG',
          alert: true,
          alertTitle: 'Listo',
          alertMessage: '¡Registro Exitoso!',
          alertIcon: 'success',
          showConfirmButton: false,
          timer: 3000,
          ruta: ''
        });
      }
    }
  );
});

// aqui llamamos autenticacion.js

autenticar(app, connection, bcryptjs, upload, Swal);

// 13.- Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.listen(3000, (req, res) => {
  console.log('SERVER RUNNING IN http://localhost:3000');
});

// variable para fondos
const backgrounds = {
  '/': 'resources/images/fondoprincipal1.jpg',
  '/login': 'resources/images/2021-08-07 17.40.37.jpg',
  '/register': 'resources/images/fondoRegister.JPG',
  '/recursos': 'resources/images/recursos.jpg',
  '/agenda': 'resources/images/agenda.jpg',
};