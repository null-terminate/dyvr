import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div>dyvr &copy; {new Date().getFullYear()}</div>
    </footer>
  );
};

export default Footer;
