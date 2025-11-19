import api from '../config/api';

const getCarouselImages = async (): Promise<string[]> => {
	try {
		const response = await api.get('/content/carousel');
		const images = response.data?.data || response.data || [];
		return Array.isArray(images) ? images : [];
	} catch (error) {
		console.error('Error fetching carousel images:', error);
		return [];
	}
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
