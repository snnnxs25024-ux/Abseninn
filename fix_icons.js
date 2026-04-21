const fs = require('fs');

const fixIcons = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove local icon imports
    content = content.replace(/import [a-zA-Z]+Icon from '\.\.\/components\/icons\/[a-zA-Z]+Icon';\n/g, '');
    content = content.replace(/import [a-zA-Z]+Icon from '\.\/components\/icons\/[a-zA-Z]+Icon';\n/g, '');
    
    // Add lucide imports if needed
    const iconsToImport = new Set();
    
    // Replace components
    if (content.match(/<DownloadIcon/)) iconsToImport.add('Download');
    if (content.match(/<ViewIcon/)) iconsToImport.add('Eye');
    if (content.match(/<DeleteIcon/)) iconsToImport.add('Trash2');
    if (content.match(/<CopyIcon/)) iconsToImport.add('Copy');
    if (content.match(/<EditIcon/)) iconsToImport.add('Edit');
    if (content.match(/<PrintIcon/)) iconsToImport.add('Printer');
    if (content.match(/<HamburgerIcon/)) iconsToImport.add('Menu');
    if (content.match(/<UploadIcon/)) iconsToImport.add('Upload');
    if (content.match(/<AddIcon/)) iconsToImport.add('Plus');
    if (content.match(/<SearchIcon/)) iconsToImport.add('Search');
    if (content.match(/<IdCardIcon/)) iconsToImport.add('User');
    
    content = content.replace(/<DownloadIcon[^>]*>/g, '<Download size={16} />');
    content = content.replace(/<ViewIcon[^>]*>/g, '<Eye size={16} />');
    content = content.replace(/<DeleteIcon[^>]*>/g, '<Trash2 size={16} />');
    content = content.replace(/<CopyIcon[^>]*>/g, '<Copy size={16} />');
    content = content.replace(/<EditIcon[^>]*>/g, '<Edit size={16} />');
    content = content.replace(/<PrintIcon[^>]*>/g, '<Printer size={16} />');
    content = content.replace(/<HamburgerIcon[^>]*>/g, '<Menu size={24} />');
    content = content.replace(/<UploadIcon[^>]*>/g, '<Upload size={16} />');
    content = content.replace(/<AddIcon[^>]*>/g, '<Plus size={16} />');
    content = content.replace(/<SearchIcon[^>]*>/g, '<Search size={16} />');
    content = content.replace(/<IdCardIcon[^>]*>/g, '<User size={16} />');

    if (iconsToImport.size > 0) {
        // check if `lucide-react` is already imported
        const importMatch = content.match(/import \{([^}]+)\} from 'lucide-react';/);
        if (importMatch) {
            const existingIcons = importMatch[1].split(',').map(s => s.trim());
            for (let icon of existingIcons) iconsToImport.add(icon);
            content = content.replace(/import \{[^}]+\} from 'lucide-react';\n/, `import { ${Array.from(iconsToImport).join(', ')} } from 'lucide-react';\n`);
        } else {
            // prepend to the top right after react
            content = content.replace(/(import React[^;]+;\n)/, `$1import { ${Array.from(iconsToImport).join(', ')} } from 'lucide-react';\n`);
        }
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed icons in ${filePath}`);
};

const filesToFix = [
    './pages/Dashboard.tsx',
    './pages/Database.tsx',
    './pages/LoginPage.tsx',
    './pages/UpdatePasswordPage.tsx',
    './pages/WelcomePage.tsx',
    './App.tsx',
    './components/Sidebar.tsx'
];

filesToFix.forEach(fixIcons);
