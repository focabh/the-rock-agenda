import React from 'react';
import './globals.css';

const RootLayout = ({ children }) => {
  return (
    <html lang="en">
      <head>
        <title>My Next.js App</title>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
};

export default RootLayout;