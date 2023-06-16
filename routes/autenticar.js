module.exports = function (app, connection, bcryptjs, upload, Swal) {
    // 11.- Autenticación
    app.post('/auth', upload.single('avatar'), async (req, res) => {
        const user = req.body.user;
        const pass = req.body.pass;
      
        if (user && pass) {
          connection.query('SELECT * FROM users WHERE user = ?', [user], async (error, results) => {
            if (results.length == 0 || !(await bcryptjs.compare(pass, results[0].pass))) {
              // Código de autenticación incorrecta
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Usuario o contraseña incorrectos',
              });
              res.render('login', {
                backgroundImage: 'resources/images/2021-08-07 17.40.37.jpg',
                alert: true,
                alertTitle: 'Error',
                alertMessage: 'Usuario o contraseña incorrectos',
                alertIcon: 'error',
                showConfirmButton: true,
                timer: false,
                ruta: 'login',
              });
            } else {
              req.session.loggedin = true;
              req.session.name = results[0].name;
      
              req.session.avatar = req.session.avatar || results[0].avatar; // Guarda el nombre de la imagen en la sesión
      
              if (req.file) {
                let avatar = req.file.filename;
      
                if (avatar.length <= 250) {
                  req.session.avatar = avatar;
      
                  connection.query('UPDATE users SET avatar = ? WHERE user = ?', [avatar, results[0].user], (error, results) => {
                    if (error) {
                      console.log(error);
                    } else {
                      
                      Swal.fire({
                        icon: 'success',
                        title: 'Conexión exitosa',
                        text: '¡LOGIN CORRECTO!',
                      });
                      res.render('login', {
                        backgroundImage: 'resources/images/2021-08-07 17.40.37.jpg',
                        alert: true,
                        alertTitle: 'Conexión exitosa',
                        alertMessage: '¡LOGIN CORRECTO!',
                        alertIcon: 'success',
                        showConfirmButton: false,
                        timer: 2500,
                        ruta: '',
                      });
                    }
                  });
                } else {
                  console.log('El nombre de la imagen excede la longitud máxima permitida');
                
                  res.render('login', {
                    backgroundImage: 'resources/images/2021-08-07 17.40.37.jpg',
                    alert: true,
                    alertTitle: 'Error',
                    alertMessage: 'El nombre de la imagen excede la longitud máxima permitida',
                    alertIcon: 'error',
                    showConfirmButton: true,
                    timer: false,
                    ruta: 'login',
                  });
                }
              } else {
                // Resto del código de respuesta si no se cargó un archivo
                Swal.fire({
                  icon: 'success',
                  title: 'Conexión exitosa',
                  text: '¡LOGIN CORRECTO!',
                });
                res.render('login', {
                  backgroundImage: 'resources/images/2021-08-07 17.40.37.jpg',
                  alert: true,
                  alertTitle: 'Conexión exitosa',
                  alertMessage: '¡LOGIN CORRECTO!',
                  alertIcon: 'success',
                  showConfirmButton: false,
                  timer: 2500,
                  ruta: '',
                });
              }
            }
          });
        } else {
          // Código de autenticación incorrecta
          Swal.fire({
            icon: 'warning',
            title: 'Advertencia',
            text: '¡Por favor ingresa tus datos!',
          });
          res.render('login', {
            backgroundImage: 'resources/images/2021-08-07 17.40.37.jpg',
            alert: true,
            alertTitle: 'Advertencia',
            alertMessage: '¡Por favor ingresa tus datos!',
            alertIcon: 'warning',
            showConfirmButton: true,
            timer: false,
            ruta: 'login',
          });
        }
      });
  
    // 12.- Autenticar pages
    app.get('/', (req, res) => {
        let backgroundImage = backgrounds[req.path];
        let login = req.session.loggedin;
        let name = req.session.name;
        if (req.session.loggedin) {
          res.render('index', { backgroundImage, login, name, avatar: req.session.avatar });
        } else {
          res.render('index', { backgroundImage, login, name });
        }
      });
  };