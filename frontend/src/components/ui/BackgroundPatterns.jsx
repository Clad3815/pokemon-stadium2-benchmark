import React from 'react';

export const PokeballPattern = () => (
  <div className="absolute inset-0 z-0 overflow-hidden fixed">
    {/* Top half - red */}
    <div className="absolute top-0 left-0 right-0 h-[50%] bg-red-800" />
    
    {/* Bottom half - navy */}
    <div className="absolute bottom-0 left-0 right-0 h-[50%] bg-gray-900" />
    
    {/* Middle separator - black line */}
    <div className="absolute top-1/2 left-0 right-0 h-8 bg-black transform -translate-y-1/2" />
  </div>
);

export const StadiumPattern = () => (
  <div className="fixed inset-0 z-0 overflow-hidden opacity-20">
    {/* Fond de base */}
    <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-slate-900 to-indigo-900"></div>
    
    {/* Motif grille de stade - more subtle */}
    <div className="absolute inset-0" style={{ 
      backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)`,
      backgroundSize: '30px 30px' 
    }}></div>
    
    {/* Effet lumineux */}
    <div className="absolute top-0 left-0 right-0 h-60 bg-gradient-to-b from-blue-500/10 to-transparent"></div>
    
    {/* Lignes d'arène */}
    <div className="absolute top-1/4 left-0 right-0 h-1 bg-blue-400/10"></div>
    <div className="absolute top-3/4 left-0 right-0 h-1 bg-blue-400/10"></div>
    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-900 to-transparent"></div>
    
    {/* Symbole central */}
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border-4 border-yellow-400/10"></div>
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full border-4 border-yellow-400/10"></div>
  </div>
); 