import React from 'react';

const BouncingBallsLoader = ({ size = 'regular' }) => {
  // Size variants for the loader
  const sizeClasses = {
    small: 'w-[40px] h-[12px]',
    regular: 'w-[60px] h-[16px]',
    large: 'w-[90px] h-[20px]'
  };
  
  const ballSizeClasses = {
    small: 'w-3 h-3',
    regular: 'w-4 h-4',
    large: 'w-5 h-5'
  };

  return (
    <div className={`LoaderBalls ${sizeClasses[size] || sizeClasses.regular} flex justify-between items-center`}>
      <div className={`LoaderBalls__item ${ballSizeClasses[size] || ballSizeClasses.regular} rounded-full`}></div>
      <div className={`LoaderBalls__item ${ballSizeClasses[size] || ballSizeClasses.regular} rounded-full`}></div>
      <div className={`LoaderBalls__item ${ballSizeClasses[size] || ballSizeClasses.regular} rounded-full`}></div>
    </div>
  );
};

export default BouncingBallsLoader;