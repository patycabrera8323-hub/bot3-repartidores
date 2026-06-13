const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('===================================================');
  console.log(' Nexus REPARTIDOR Panel iniciado');
  console.log(` URL de acceso: http://localhost:${PORT}`);
  console.log('===================================================');
});
