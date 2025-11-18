import api from '../config/api';

const getCarouselImages = async (): Promise<string[]> => {
	const response = await api.get('/content/carousel');
	return response.data.data;
};

const deleteCarouselImage = async (filename: string): Promise<void> => {
	await api.delete(`/content/carousel/${filename}`);
};

const uploadCarouselImage = async (formData: FormData): Promise<void> => {
	await api.post('/upload/carousel', formData, {
		headers: {
			'Content-Type': 'multipart/form-data',
		},
	});
};

const uploadCarouselImages = async (files: File[]): Promise<void> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('images', file); // 👈 el campo debe llamarse "images"
  });

  await api.post('/content/carousel', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

const contentManagementService = {
	getCarouselImages,
	deleteCarouselImage,
	uploadCarouselImage,
	uploadCarouselImages,
};

export default contentManagementService;
