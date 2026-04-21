const fs = require('fs');
const pages = [
  'Attendance.tsx',
  'OpenList.tsx',
  'PublicAttendance.tsx',
  'Settings.tsx'
];

pages.forEach(p => {
  const content = `import React from 'react';\n\nconst ${p.split('.')[0]}: React.FC<any> = () => { return <div>Under construction</div>; };\nexport default ${p.split('.')[0]};\n`;
  if (!fs.existsSync('./pages/' + p)) {
    fs.writeFileSync('./pages/' + p, content);
    console.log('Created ' + p);
  }
});
